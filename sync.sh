#!/usr/bin/env bash
set -euo pipefail

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
RESET='\033[0m'

info()    { printf "${CYAN}▸${RESET} %s\n" "$*"; }
success() { printf "${GREEN}✓${RESET} %s\n" "$*"; }
warn()    { printf "${YELLOW}⚠${RESET} %s\n" "$*"; }
fail()    { printf "${RED}✗${RESET} %s\n" "$*"; }

# Collect demo directories (those containing package.json)
get_demos() {
  for dir in */; do
    [ -f "${dir}package.json" ] && echo "${dir%/}"
  done
}

has_remote() {
  git remote get-url "workflow-${1}" &>/dev/null
}

#--- Commands ----------------------------------------------------------------

cmd_pull() {
  info "Pulling latest from origin main..."
  git pull origin main
  success "Pull complete."
}

cmd_push() {
  info "Pushing all subtrees to their individual repos..."
  local count=0 skipped=0 failed=0
  for slug in $(get_demos); do
    if ! has_remote "$slug"; then
      warn "Skipping ${slug} — no remote workflow-${slug}"
      ((skipped++)) || true
      continue
    fi
    info "Pushing ${slug}..."
    if git subtree push --prefix="${slug}" "workflow-${slug}" main; then
      success "${slug} pushed."
      ((count++)) || true
    else
      fail "${slug} failed to push."
      ((failed++)) || true
    fi
  done
  echo ""
  success "Done. Pushed: ${count}  Skipped: ${skipped}  Failed: ${failed}"
}

cmd_push_one() {
  local demos=()
  while IFS= read -r d; do
    demos+=("$d")
  done < <(get_demos)

  if [ ${#demos[@]} -eq 0 ]; then
    fail "No demos found."
    exit 1
  fi

  echo ""
  printf "${BOLD}Pick a demo to push:${RESET}\n"
  local i=1
  for slug in "${demos[@]}"; do
    if has_remote "$slug"; then
      printf "  ${GREEN}%2d)${RESET} %s\n" "$i" "$slug"
    else
      printf "  ${YELLOW}%2d)${RESET} %s ${YELLOW}(no remote)${RESET}\n" "$i" "$slug"
    fi
    ((i++)) || true
  done
  echo ""
  printf "Enter number: "
  read -r choice

  if ! [[ "$choice" =~ ^[0-9]+$ ]] || [ "$choice" -lt 1 ] || [ "$choice" -gt ${#demos[@]} ]; then
    fail "Invalid choice."
    exit 1
  fi

  local slug="${demos[$((choice - 1))]}"
  if ! has_remote "$slug"; then
    fail "No remote workflow-${slug} configured. Run './sync.sh add' first."
    exit 1
  fi

  info "Pushing ${slug}..."
  git subtree push --prefix="${slug}" "workflow-${slug}" main
  success "${slug} pushed."
}

cmd_sync() {
  cmd_pull
  echo ""
  cmd_push
}

cmd_status() {
  printf "\n${BOLD}Demo subtree status:${RESET}\n\n"
  local total=0 configured=0 missing=0
  for slug in $(get_demos); do
    ((total++)) || true
    if has_remote "$slug"; then
      printf "  ${GREEN}✓${RESET} %-30s  remote: workflow-${slug}\n" "$slug"
      ((configured++)) || true
    else
      printf "  ${RED}✗${RESET} %-30s  ${RED}no remote${RESET}\n" "$slug"
      ((missing++)) || true
    fi
  done
  echo ""
  info "Total: ${total}  Configured: ${configured}  Missing: ${missing}"
}

cmd_init_new() {
  printf "\n${BOLD}Checking for demos without remotes...${RESET}\n\n"
  local new_demos=()
  for slug in $(get_demos); do
    has_remote "$slug" || new_demos+=("$slug")
  done

  if [ ${#new_demos[@]} -eq 0 ]; then
    success "All demos already have remotes configured."
    return
  fi

  info "Found ${#new_demos[@]} demo(s) without remotes:"
  for slug in "${new_demos[@]}"; do
    printf "  ${YELLOW}•${RESET} %s\n" "$slug"
  done
  echo ""
  printf "Create GitHub repos and push all of these? [y/N] "
  read -r confirm
  [[ "$confirm" =~ ^[Yy]$ ]] || return 0

  local created=0 failed=0
  for slug in "${new_demos[@]}"; do
    local repo="vercel-labs/workflow-${slug}"
    local remote="workflow-${slug}"

    echo ""
    info "Setting up ${slug}..."

    # Create GitHub repo
    if gh repo view "$repo" &>/dev/null; then
      warn "Repo ${repo} already exists on GitHub."
    else
      if gh repo create "$repo" --public --confirm; then
        success "Created ${repo}."
      else
        fail "Failed to create ${repo}. Skipping."
        ((failed++)) || true
        continue
      fi
    fi

    # Add remote
    if ! has_remote "$slug"; then
      git remote add "$remote" "https://github.com/${repo}.git"
      success "Remote ${remote} added."
    fi

    # Push subtree
    info "Pushing subtree ${slug}..."
    if git subtree push --prefix="${slug}" "$remote" main; then
      success "${slug} pushed."
      ((created++)) || true
    else
      fail "${slug} subtree push failed."
      ((failed++)) || true
    fi
  done

  echo ""
  success "Done. Created: ${created}  Failed: ${failed}"
}

cmd_add() {
  printf "\n${BOLD}Add a new demo as a subtree${RESET}\n\n"
  printf "Demo slug (directory name): "
  read -r slug

  if [ -z "$slug" ]; then
    fail "Slug cannot be empty."
    exit 1
  fi

  local repo="vercel-labs/workflow-${slug}"
  local remote="workflow-${slug}"

  # Check if directory already exists
  if [ -d "$slug" ]; then
    warn "Directory ${slug}/ already exists."
  fi

  # Check if remote already exists
  if has_remote "$slug"; then
    warn "Remote ${remote} already exists."
    printf "Continue anyway? [y/N] "
    read -r confirm
    [[ "$confirm" =~ ^[Yy]$ ]] || exit 0
  fi

  # Create GitHub repo
  info "Creating GitHub repo ${repo}..."
  if gh repo view "$repo" &>/dev/null; then
    warn "Repo ${repo} already exists on GitHub."
  else
    gh repo create "$repo" --public --confirm
    success "Created ${repo}."
  fi

  # Add remote
  if ! has_remote "$slug"; then
    info "Adding remote ${remote}..."
    git remote add "$remote" "https://github.com/${repo}.git"
    success "Remote added."
  fi

  # Subtree add (only if directory exists with content to push)
  if [ -d "$slug" ]; then
    info "Directory exists — pushing as subtree..."
    git subtree push --prefix="${slug}" "$remote" main
    success "Subtree pushed."
  else
    warn "No ${slug}/ directory found. Create the demo first, commit it, then run './sync.sh push-one'."
  fi

  echo ""
  success "Done! Demo ${slug} is configured."
  info "v0 URL: https://v0.app/chat/api/open?url=https://github.com/${repo}"
}

#--- Menu / Dispatch ---------------------------------------------------------

show_menu() {
  printf "\n${BOLD}Workflow Subtree Sync${RESET}\n\n"
  printf "  ${CYAN}1)${RESET} sync      — Pull latest, then push all subtrees\n"
  printf "  ${CYAN}2)${RESET} pull      — Pull from origin main\n"
  printf "  ${CYAN}3)${RESET} push      — Push all subtrees to individual repos\n"
  printf "  ${CYAN}4)${RESET} push-one  — Pick a single subtree to push\n"
  printf "  ${CYAN}5)${RESET} status    — Show remote status for all demos\n"
  printf "  ${CYAN}6)${RESET} add       — Add a new demo as a subtree\n"
  printf "  ${CYAN}7)${RESET} init-new  — Create repos & push all unconfigured demos\n"
  echo ""
  printf "Choose [1-7]: "
  read -r choice

  case "$choice" in
    1) cmd_sync ;;
    2) cmd_pull ;;
    3) cmd_push ;;
    4) cmd_push_one ;;
    5) cmd_status ;;
    6) cmd_add ;;
    7) cmd_init_new ;;
    *) fail "Invalid choice."; exit 1 ;;
  esac
}

case "${1:-}" in
  sync)     cmd_sync ;;
  pull)     cmd_pull ;;
  push)     cmd_push ;;
  push-one) cmd_push_one ;;
  status)   cmd_status ;;
  add)      cmd_add ;;
  init-new) cmd_init_new ;;
  "")       show_menu ;;
  *)        fail "Unknown command: $1"
            echo "Usage: $0 [sync|pull|push|push-one|status|add|init-new]"
            exit 1 ;;
esac
