APP_DIR := kitchen-pos
ENV_LOCAL := $(APP_DIR)/.env.local
ENV_SANDBOX := $(APP_DIR)/.env.sandbox
ENV_PROD := $(APP_DIR)/.env.prod

.PHONY: help dev-sandbox dev-prod build-sandbox build-prod start-sandbox start-prod \
        guard-sandbox guard-prod

help:
	@echo "Targets:"
	@echo "  make dev-sandbox    Run the dev server against the sandbox Supabase project"
	@echo "  make dev-prod       Run the dev server against the production Supabase project"
	@echo "  make build-sandbox  Build the app against the sandbox Supabase project"
	@echo "  make build-prod     Build the app against the production Supabase project"
	@echo "  make start-sandbox  Serve the last build against the sandbox Supabase project"
	@echo "  make start-prod     Serve the last build against the production Supabase project"
	@echo ""
	@echo "First-time setup: copy $(APP_DIR)/.env.sandbox.example and .env.prod.example"
	@echo "to .env.sandbox / .env.prod and fill in each project's URL and key."

guard-sandbox:
	@test -f $(ENV_SANDBOX) || { \
		echo "Missing $(ENV_SANDBOX)."; \
		echo "Copy $(APP_DIR)/.env.sandbox.example to $(ENV_SANDBOX) and fill in your sandbox Supabase project's URL/key."; \
		exit 1; \
	}

guard-prod:
	@test -f $(ENV_PROD) || { \
		echo "Missing $(ENV_PROD)."; \
		echo "Copy $(APP_DIR)/.env.prod.example to $(ENV_PROD) and fill in your production Supabase project's URL/key."; \
		exit 1; \
	}

# Point .env.local (the file Next.js always loads) at the selected
# environment, backing up whatever was there so nothing is lost.
define use_env
	@if [ -f "$(ENV_LOCAL)" ]; then cp "$(ENV_LOCAL)" "$(ENV_LOCAL).bak"; fi
	@cp "$(1)" "$(ENV_LOCAL)"
endef

dev-sandbox: guard-sandbox
	$(call use_env,$(ENV_SANDBOX))
	cd $(APP_DIR) && npm run dev

dev-prod: guard-prod
	$(call use_env,$(ENV_PROD))
	cd $(APP_DIR) && npm run dev

build-sandbox: guard-sandbox
	$(call use_env,$(ENV_SANDBOX))
	cd $(APP_DIR) && npm run build

build-prod: guard-prod
	$(call use_env,$(ENV_PROD))
	cd $(APP_DIR) && npm run build

start-sandbox: guard-sandbox
	$(call use_env,$(ENV_SANDBOX))
	cd $(APP_DIR) && npm run start

start-prod: guard-prod
	$(call use_env,$(ENV_PROD))
	cd $(APP_DIR) && npm run start
