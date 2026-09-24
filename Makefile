# JS-Delphi — web tabanlı Delphi RAD IDE
#   make install   → Python venv + npm bağımlılıkları
#   make run       → IDE'yi derle ve http://127.0.0.1:8000 adresinde sun
#   make dev       → backend (--reload) + Vite dev sunucusu (http://127.0.0.1:5173)

PYTHON ?= python3
VENV   ?= .venv
HOST   ?= 127.0.0.1
PORT   ?= 8000
PY     := $(VENV)/bin/python
NPM    := npm --prefix frontend

.DEFAULT_GOAL := help
.PHONY: help install install-db runtime build run serve dev backend frontend test typecheck check screenshots clean distclean

help: ## Hedefleri listele
	@grep -hE '^[a-z-]+:.*## ' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*## "}; {printf "  \033[36m%-12s\033[0m %s\n", $$1, $$2}'

$(PY):
	$(PYTHON) -m venv $(VENV)
	$(PY) -m pip install -q --upgrade pip

install: $(PY) ## Python ve npm bağımlılıklarını kur
	$(PY) -m pip install -q -r backend/requirements-dev.txt
	$(NPM) install

install-db: $(PY) ## İsteğe bağlı DB sürücüleri (PostgreSQL, MySQL/MariaDB, MSSQL, MongoDB)
	$(PY) -m pip install -q -r backend/requirements-db.txt

runtime: ## vcl.ts → vcl.js + vcl.d.ts + vcl.manifest.json
	$(NPM) run build:runtime

build: ## IDE'yi derle (frontend/dist)
	$(NPM) run build

run: build serve ## Derle ve tek sunucudan çalıştır

serve: ## Backend'i derlenmiş IDE ile başlat
	$(PY) -m uvicorn backend.main:app --host $(HOST) --port $(PORT)

backend: ## Yalnızca backend (otomatik yeniden yükleme)
	$(PY) -m uvicorn backend.main:app --host $(HOST) --port $(PORT) --reload --reload-dir backend

frontend: ## Yalnızca Vite dev sunucusu (/api, /ws, /preview → backend proxy)
	$(NPM) run dev -- --host $(HOST)

dev: runtime ## Backend + Vite birlikte (Ctrl+C ikisini de durdurur)
	@trap 'kill 0' INT TERM; \
	$(PY) -m uvicorn backend.main:app --host $(HOST) --port $(PORT) --reload --reload-dir backend & \
	JSD_BACKEND=http://$(HOST):$(PORT) $(NPM) run dev -- --host $(HOST) & \
	wait

test: ## Backend testleri
	$(PY) -m pytest backend/tests -q

typecheck: ## TypeScript tip denetimi (IDE + VCL runtime)
	$(NPM) run typecheck

check: typecheck test ## Tip denetimi + testler

screenshots: ## Çalışan sunucudan ekran görüntüleri (docs/screenshots)
	JSD_URL=http://$(HOST):$(PORT) $(NPM) run screenshots

clean: ## Derleme çıktılarını sil
	rm -rf frontend/dist frontend/.runtime-types
	find backend -name __pycache__ -type d -prune -exec rm -rf {} +

distclean: clean ## Bağımlılıklar ve yerel veriler dahil her şeyi sil
	rm -rf $(VENV) frontend/node_modules data projects
