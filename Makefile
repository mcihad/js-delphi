# JS-Delphi — web tabanlı Delphi RAD IDE
#   make install   → uv sync (Python ortamı) + npm bağımlılıkları
#   make run       → IDE'yi derle ve http://127.0.0.1:8000 adresinde sun
#   make dev       → backend (--reload) + Vite dev sunucusu (http://127.0.0.1:5173)

UV     ?= uv
HOST   ?= 127.0.0.1
PORT   ?= 8000
NPM    := npm --prefix frontend
UVICORN := $(UV) run uvicorn backend.main:app --host $(HOST) --port $(PORT)

.DEFAULT_GOAL := help
.PHONY: help uv install install-db lock runtime build run serve dev backend frontend test typecheck check screenshots clean distclean

help: ## Hedefleri listele
	@grep -hE '^[a-z-]+:.*## ' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*## "}; {printf "  \033[36m%-12s\033[0m %s\n", $$1, $$2}'

uv:
	@command -v $(UV) >/dev/null 2>&1 || { echo "uv bulunamadı → curl -LsSf https://astral.sh/uv/install.sh | sh"; exit 1; }

install: uv ## Python (uv sync → .venv) ve npm bağımlılıklarını kur
	$(UV) sync
	$(NPM) install

install-db: uv ## İsteğe bağlı DB sürücüleriyle kur (PostgreSQL, MySQL/MariaDB, MSSQL, MongoDB)
	$(UV) sync --extra db

lock: uv ## pyproject.toml değişince uv.lock'u güncelle
	$(UV) lock

runtime: ## vcl.ts → vcl.js + vcl.d.ts + vcl.manifest.json
	$(NPM) run build:runtime

build: ## IDE'yi derle (frontend/dist)
	$(NPM) run build

run: build serve ## Derle ve tek sunucudan çalıştır

serve: uv ## Backend'i derlenmiş IDE ile başlat
	$(UVICORN)

backend: uv ## Yalnızca backend (otomatik yeniden yükleme)
	$(UVICORN) --reload --reload-dir backend

frontend: ## Yalnızca Vite dev sunucusu (/api, /ws, /preview → backend proxy)
	$(NPM) run dev -- --host $(HOST)

dev: uv runtime ## Backend + Vite birlikte (Ctrl+C ikisini de durdurur)
	@trap 'kill 0' INT TERM; \
	$(UVICORN) --reload --reload-dir backend & \
	JSD_BACKEND=http://$(HOST):$(PORT) $(NPM) run dev -- --host $(HOST) & \
	wait

test: uv ## Backend testleri
	$(UV) run pytest -q

typecheck: ## TypeScript tip denetimi (IDE + VCL runtime)
	$(NPM) run typecheck

check: typecheck test ## Tip denetimi + testler

screenshots: ## Çalışan sunucudan ekran görüntüleri (docs/screenshots)
	JSD_URL=http://$(HOST):$(PORT) $(NPM) run screenshots

clean: ## Derleme çıktılarını sil
	rm -rf frontend/dist frontend/.runtime-types
	find backend -name __pycache__ -type d -prune -exec rm -rf {} +

distclean: clean ## Bağımlılıklar ve yerel veriler dahil her şeyi sil
	rm -rf .venv frontend/node_modules data projects
