Task: Remove formation and baiduan from default features in dragon-phoenix.js

- Change implemented: updated default features array to ['lunwu', 'yunji'] while keeping the formation and baiduan methods intact for manual use.
- Validation: syntax check passed (node --check src/actions/dragon-phoenix.js).
- Rationale: user request to auto-run only 龙凰论武 and 龙凰云集; retain manual access to other two features.

Status: completed
