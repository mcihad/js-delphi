"""WS /ws/{project_id} — multi-user live sync (presence, selections, save/build events).

Protocol (JSON messages):
  client → {"type":"auth","token":"…","client_id":"…?"}          (first message, ≤10 s)
  server → {"type":"welcome","client_id":"…","peers":[…]}
  client → {"type":"presence","state":{"form":"Form1","selection":["btnKaydet"]}}
  client → {"type":"design.preview","form_id":"…","changes":[…]}   (transient, not stored)
  client → {"type":"ping"}                                          → {"type":"pong"}
  server → peer.join | peer.leave | presence | form.saved | form.created | form.deleted |
           project.updated | build.done | design.preview
"""
from __future__ import annotations

import asyncio
import json

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from backend.config import settings
from backend.db import SessionLocal
from backend.deps import project_role, user_from_token
from backend.models import Project
from backend.services.sync_service import Peer, hub

router = APIRouter()

_RELAYED = {"presence", "design.preview", "cursor"}


@router.websocket("/ws/{project_id}")
async def project_socket(ws: WebSocket, project_id: str):
    await ws.accept()
    try:
        first = await asyncio.wait_for(ws.receive_text(), timeout=10)
        msg = json.loads(first)
    except (asyncio.TimeoutError, json.JSONDecodeError, WebSocketDisconnect):
        await ws.close(code=4401)
        return
    if not isinstance(msg, dict) or msg.get("type") != "auth":
        await ws.close(code=4401)
        return

    db = SessionLocal()
    try:
        user = user_from_token(db, str(msg.get("token", "")))
        project = db.get(Project, project_id)
        if user is None or project is None or project_role(db, project, user) is None:
            await ws.close(code=4403)
            return
        peer = Peer(
            client_id=str(msg.get("client_id") or hub.new_client_id())[:32],
            user_id=user.id,
            username=user.username,
            display_name=user.display_name or user.username,
            color=user.color,
            socket=ws,
        )
    finally:
        db.close()

    others = await hub.join(project_id, peer)
    await ws.send_json({"type": "welcome", "client_id": peer.client_id, "peers": others, "user": peer.public()})
    try:
        while True:
            raw = await ws.receive_text()
            if len(raw) > settings.ws_max_message_bytes:
                await ws.close(code=4413)
                break
            try:
                data = json.loads(raw)
            except json.JSONDecodeError:
                continue
            kind = data.get("type") if isinstance(data, dict) else None
            if kind == "ping":
                await ws.send_json({"type": "pong"})
            elif kind in _RELAYED:
                if kind == "presence" and isinstance(data.get("state"), dict):
                    peer.state = {k: data["state"][k] for k in ("form", "selection", "tab") if k in data["state"]}
                    data = {"type": "presence", "client_id": peer.client_id, "state": peer.state}
                else:
                    data = {**data, "client_id": peer.client_id, "username": peer.username, "color": peer.color}
                await hub.broadcast(project_id, data, exclude=peer.client_id)
    except WebSocketDisconnect:
        pass
    finally:
        await hub.leave(project_id, peer.client_id)
