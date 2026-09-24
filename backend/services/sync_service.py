"""SyncService — per project WebSocket rooms for multi-user live collaboration.

Persistence always goes through the REST API (debounced saves from the IDE); the hub
fans out *events* (form saved, build finished, presence/selection, transient drag
previews) to every other client of the same project.
"""
from __future__ import annotations

import asyncio
import logging
import secrets
from dataclasses import dataclass, field
from typing import Any

from fastapi import WebSocket

log = logging.getLogger("jsdelphi.sync")


@dataclass
class Peer:
    client_id: str
    user_id: int
    username: str
    display_name: str
    color: str
    socket: WebSocket
    state: dict[str, Any] = field(default_factory=dict)  # form / selection / cursor

    def public(self) -> dict[str, Any]:
        return {
            "client_id": self.client_id,
            "user_id": self.user_id,
            "username": self.username,
            "display_name": self.display_name,
            "color": self.color,
            "state": self.state,
        }


class SyncHub:
    def __init__(self) -> None:
        self._rooms: dict[str, dict[str, Peer]] = {}
        self._lock = asyncio.Lock()

    @staticmethod
    def new_client_id() -> str:
        return secrets.token_hex(6)

    async def join(self, project_id: str, peer: Peer) -> list[dict[str, Any]]:
        async with self._lock:
            room = self._rooms.setdefault(project_id, {})
            others = [p.public() for p in room.values()]
            room[peer.client_id] = peer
        await self.broadcast(project_id, {"type": "peer.join", "peer": peer.public()}, exclude=peer.client_id)
        return others

    async def leave(self, project_id: str, client_id: str) -> None:
        async with self._lock:
            room = self._rooms.get(project_id, {})
            room.pop(client_id, None)
            if not room:
                self._rooms.pop(project_id, None)
        await self.broadcast(project_id, {"type": "peer.leave", "client_id": client_id})

    def peers(self, project_id: str) -> list[dict[str, Any]]:
        return [p.public() for p in self._rooms.get(project_id, {}).values()]

    def get(self, project_id: str, client_id: str) -> Peer | None:
        return self._rooms.get(project_id, {}).get(client_id)

    async def broadcast(self, project_id: str, message: dict[str, Any], exclude: str | None = None) -> None:
        peers = [p for cid, p in list(self._rooms.get(project_id, {}).items()) if cid != exclude]
        if not peers:
            return
        results = await asyncio.gather(*(p.socket.send_json(message) for p in peers), return_exceptions=True)
        for peer, res in zip(peers, results):
            if isinstance(res, Exception):
                log.debug("drop peer %s: %s", peer.client_id, res)
                await self.leave(project_id, peer.client_id)


hub = SyncHub()
