APP_DIR := kitchen-pos
ENV_LOCAL := $(APP_DIR)/.env.local
ENV_SANDBOX := $(APP_DIR)/.env.sandbox
ENV_PROD := $(APP_DIR)/.env.prod

.PHONY: help dev-sandbox dev-prod build-sandbox build-prod start-sandbox start-prod \
        guard-sandbox guard-prod \
        link-sandbox link-prod migration-new migrate-status-sandbox migrate-status-prod \
        migrate-sandbox migrate-prod

help:
	@echo "App targets:"
	@echo "  make dev-sandbox    Run the dev server against the sandbox Supabase project"
	@echo "  make dev-prod       Run the dev server against the production Supabase project"
	@echo "  make build-sandbox  Build the app against the sandbox Supabase project"
	@echo "  make build-prod     Build the app against the production Supabase project"
	@echo "  make start-sandbox  Serve the last build against the sandbox Supabase project"
	@echo "  make start-prod     Serve the last build against the production Supabase project"
	@echo ""
	@echo "Migration targets (supabase/migrations is shared; each target applies it to one DB):"
	@echo "  make migration-new NAME=x   Create a new local migration file (not env-specific)"
	@echo "  make migrate-status-sandbox Show applied/pending migrations on sandbox (read-only)"
	@echo "  make migrate-status-prod    Show applied/pending migrations on production (read-only)"
	@echo "  make migrate-sandbox        Dry-run then, on confirmation, push migrations to sandbox"
	@echo "  make migrate-prod           Dry-run then, on confirmation, push migrations to production"
	@echo ""
	@echo "First-time setup: copy $(APP_DIR)/.env.sandbox.example and .env.prod.example"
	@echo "to .env.sandbox / .env.prod and fill in each project's URL and key."
	@echo "For migrate-* targets: run 'supabase login' once, then the first migrate/link"
	@echo "to each project will prompt for its DB password and cache it in your OS"
	@echo "keychain (never written to a file)."

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

# --- Migrations -------------------------------------------------------
#
# supabase/migrations is a single shared history applied independently to
# each project. We use `supabase link` + `--linked` (not --db-url) so the
# DB password is never written to a file by us — the CLI prompts for it
# once per project and caches it in the OS keychain. Each migrate-*
# target re-links to its own project ref immediately before pushing, so
# you can never accidentally push to the project that happens to still
# be linked from last time.

define project_ref
$(shell grep -E '^NEXT_PUBLIC_SUPABASE_URL=' $(1) | tail -1 | sed -E 's#.*https://([A-Za-z0-9]+)\.supabase\.co.*#\1#')
endef

link-sandbox: guard-sandbox
	@ref="$(call project_ref,$(ENV_SANDBOX))"; \
	if [ -z "$$ref" ]; then echo "Could not parse a project ref from NEXT_PUBLIC_SUPABASE_URL in $(ENV_SANDBOX)"; exit 1; fi; \
	echo "Linking to sandbox project ($$ref)..."; \
	supabase link --project-ref "$$ref"

link-prod: guard-prod
	@ref="$(call project_ref,$(ENV_PROD))"; \
	if [ -z "$$ref" ]; then echo "Could not parse a project ref from NEXT_PUBLIC_SUPABASE_URL in $(ENV_PROD)"; exit 1; fi; \
	echo "Linking to production project ($$ref)..."; \
	supabase link --project-ref "$$ref"

migration-new:
	@test -n "$(NAME)" || { echo "Usage: make migration-new NAME=add_something"; exit 1; }
	@supabase migration new $(NAME)

migrate-status-sandbox: link-sandbox
	@supabase migration list --linked

migrate-status-prod: link-prod
	@supabase migration list --linked

migrate-sandbox: link-sandbox
	@echo "== Pending migrations for SANDBOX =="
	@supabase db push --linked --dry-run
	@printf "Apply the above to SANDBOX? Type 'yes' to continue: "; \
	read ans; \
	if [ "$$ans" = "yes" ]; then \
		supabase db push --linked; \
	else \
		echo "Aborted."; exit 1; \
	fi

migrate-prod: link-prod
	@echo "== Pending migrations for PRODUCTION =="
	@supabase db push --linked --dry-run
	@printf "Apply the above to PRODUCTION? Type 'yes' to continue: "; \
	read ans; \
	if [ "$$ans" = "yes" ]; then \
		supabase db push --linked; \
	else \
		echo "Aborted."; exit 1; \
	fi
