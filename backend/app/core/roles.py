"""Role-based permissions inside a restaurant tenant.

Roles (audit recommendation):
  owner     — everything; only role that can manage billing and users
  manager   — everything except billing/users
  chef      — menu, recipes, kitchen, inventory, waste
  server    — bookings, CRM (read), kitchen (read-only)
  host      — bookings (read+write), CRM
  marketer  — marketing, campaigns, menu broadcast, reports

Permission check is layered on top of account_type. Staff accounts
inherit the employer's tenant data (resolved at auth time) but get a
restricted view via these matrices.
"""
from __future__ import annotations

from ..models.user import User


ROLE_OWNER    = "owner"
ROLE_MANAGER  = "manager"
ROLE_CHEF     = "chef"
ROLE_SERVER   = "server"
ROLE_HOST     = "host"
ROLE_MARKETER = "marketer"

ALL_ROLES = {ROLE_OWNER, ROLE_MANAGER, ROLE_CHEF, ROLE_SERVER, ROLE_HOST, ROLE_MARKETER}


# permission -> roles that have it. Roles not listed are denied.
# Add a permission here and the can() helper does the right thing.
PERMISSIONS: dict[str, set[str]] = {
    "billing.manage":   {ROLE_OWNER},
    "users.manage":     {ROLE_OWNER},
    "audit_log.view":   {ROLE_OWNER, ROLE_MANAGER},

    "bookings.read":    {ROLE_OWNER, ROLE_MANAGER, ROLE_HOST, ROLE_SERVER},
    "bookings.write":   {ROLE_OWNER, ROLE_MANAGER, ROLE_HOST},

    "crm.read":         {ROLE_OWNER, ROLE_MANAGER, ROLE_HOST, ROLE_SERVER, ROLE_MARKETER},
    "crm.write":        {ROLE_OWNER, ROLE_MANAGER, ROLE_HOST, ROLE_MARKETER},

    "menu.read":        ALL_ROLES,
    "menu.write":       {ROLE_OWNER, ROLE_MANAGER, ROLE_CHEF},

    "marketing.read":   {ROLE_OWNER, ROLE_MANAGER, ROLE_MARKETER},
    "marketing.write":  {ROLE_OWNER, ROLE_MANAGER, ROLE_MARKETER},

    "waste.read":       {ROLE_OWNER, ROLE_MANAGER, ROLE_CHEF},
    "waste.write":      {ROLE_OWNER, ROLE_MANAGER, ROLE_CHEF},

    "inventory.read":   {ROLE_OWNER, ROLE_MANAGER, ROLE_CHEF},
    "inventory.write":  {ROLE_OWNER, ROLE_MANAGER, ROLE_CHEF},
}


def can(user: User, permission: str) -> bool:
    role = (getattr(user, "role", None) or ROLE_OWNER).lower()
    if role not in ALL_ROLES:
        role = ROLE_OWNER
    allowed = PERMISSIONS.get(permission, set())
    return role in allowed
