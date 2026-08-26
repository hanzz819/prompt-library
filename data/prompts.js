/* ---------------------------------------------------------------------------
   THE LIBRARY LIVES HERE.

   Add a prompt = add an object to the array below, save, commit, push.
   Every device gets it on the next load. No build step, no database.

   Fields (fill-in-the-blanks) are written [IN SQUARE BRACKETS] inside `body`.
   They are detected automatically; the optional `fields` map just gives them
   nicer labels, input types and defaults.

   Careful: `body` is a JS template literal, so a literal backtick must be
   written \` and a literal ${ must be written \${.
--------------------------------------------------------------------------- */

window.PROMPT_LIBRARY = (window.PROMPT_LIBRARY || []).concat([

{
  id: 'plan-and-inspect',
  title: 'Plan and Inspect',
  category: 'Plan',
  tags: ['stable build protocol', 'read-only', 'wiring map', 'start here'],
  description: 'Use this prompt first. It activates inspection and planning only. Claude should not edit files or run live/destructive commands.',
  fields: {
    'TASK': { label: 'Approved task', type: 'textarea', hint: 'What you are asking for, in one or two sentences.' },
    'CRITERIA': { label: 'Success criteria', type: 'textarea', hint: 'How you will know it worked.' },
    'APPROVAL OR NONE': { label: 'Owner approval', type: 'text', hint: 'Name the approval, or leave as NONE.', default: 'NONE' }
  },
  body: `Follow the Stable Build Protocol.

Approved task:
[TASK]

Success criteria:
[CRITERIA]

Owner approval:
[APPROVAL OR NONE]

Begin with inspection and planning only.

Do not edit files.
Do not run live or destructive commands.
Do not commit anything.

Inspect:

1. The applicable CLAUDE.md instructions.
2. The current branch and worktree state.
3. The target files and existing implementation patterns.
4. Relevant tests and actual available commands.
5. All references pointing to files that may change.
6. The documents or code those files point to.
7. project/plans/NEXT-BUILD-PHASES.md.

Before proposing implementation, report:

1. The wiring map for every file or document that may change.
2. Files that should be changed.
3. Files that should not be changed.
4. The smallest safe implementation approach.
5. Existing patterns that should be reused.
6. Exact verification commands and expected success signals.
7. Live, destructive, or owner-gated actions that must not be run.
8. Conflicts, ambiguities, or missing approvals.

Do not begin implementation until the plan is explicit and internally consistent.`
},

{
  id: 'update-plan-before-executing',
  title: 'Update the Plan Before Executing',
  category: 'Plan',
  tags: ['stable build protocol', 'read-only', 'clarifications', 'plan mode'],
  description: 'Use after you have answered Claude’s questions but before approving implementation. Folds your clarifications into the plan without letting anything be executed.',
  fields: {
    'PASTE YOUR ANSWERS HERE': { label: 'Clarifications and corrections', type: 'textarea', hint: 'Your answers to Claude’s questions, or corrections to its assumptions.', rows: 8 }
  },
  body: `For the rest of this planning step:

- Do not edit, create, delete, move, or rename files.
- Do not run commands that modify files, databases, environments, deployments, or git state.
- Do not commit, stage, deploy, send, migrate, repair, or delete anything.
- Read-only inspection is allowed only when needed to update the plan.
- Treat every answer I provide as clarification, not authorization.
- Remain in plan mode until I explicitly approve the final plan.

Clarifications and corrections:

[PASTE YOUR ANSWERS HERE]

Update the plan using the clarifications above.

Return only:

## Updated Understanding

- What the task means now.
- What outcome is required.
- What is outside scope.

## Changes From Previous Plan

- Original assumption:
- New clarification:
- Effect on the plan:

## Updated File Plan

- Files to change.
- Files not to change.
- Exact sections or areas affected.
- Why each change is necessary.

## Updated Wiring Map

For each file that may change:

- Referenced by:
- Points to:
- References that must change:
- References that must remain unchanged:

## Updated Implementation Sequence

List the smallest safe steps in order.

## Updated Verification

- Exact commands.
- Expected success signals.
- Known baseline failures.
- Checks that will not be run.

## Gated Actions

List any live, destructive, irreversible, or owner-only actions. Mark them as NOT APPROVED unless I explicitly approve them.

## Final Approval Gate

End with exactly:

“Planning update complete. No files were changed. Waiting for explicit implementation approval.”`
},

{
  id: 'reconcile-plan-after-updates',
  title: 'Reconcile the Plan After Updates',
  category: 'Reconcile',
  tags: ['stable build protocol', 'scope drift', 'mid-flight', 'wiring recheck'],
  description: 'Use this after Claude has made some approved changes but before it continues with additional work. It forces Claude to compare the original plan with the new repository state and identify scope drift.',
  fields: {
    'TASK': { label: 'Original task', type: 'textarea' },
    'CRITERIA': { label: 'Original success criteria', type: 'textarea' },
    'PASTE THE APPROVED PLAN OR SUMMARIZE IT': { label: 'Original approved plan', type: 'textarea', hint: 'Paste it in full, or summarise it.', rows: 8 },
    'LIST UPDATES, OR ASK CLAUDE TO DETERMINE THEM FROM THE DIFF': { label: 'Updates already made', type: 'textarea', hint: 'List them, or leave the default and let Claude read the diff.', default: 'Determine them from the diff.' }
  },
  body: `Pause implementation.

Do not make further edits yet.
Do not run live or destructive commands.
Do not commit yet.

Some approved updates have now been made. Reinspect the current state and reconcile the original plan with the changes already completed.

Original task:
[TASK]

Original success criteria:
[CRITERIA]

Original approved plan:
[PASTE THE APPROVED PLAN OR SUMMARIZE IT]

Updates already made:
[LIST UPDATES, OR ASK CLAUDE TO DETERMINE THEM FROM THE DIFF]

Now report:

## Completed From Original Plan

- Planned item:
- Actual change:
- Evidence:
- Verification result:

## Plan Changes Caused by the Updates

For each changed assumption:

- Original assumption:
- New repository fact:
- Impact on the remaining plan:
- Required adjustment:

## Remaining Approved Work

List only work still required for the original task.

For each item:

- File:
- Exact change:
- Reason:
- Verification:
- Scope status: approved, needs clarification, or blocked.

## Newly Discovered Issues

Classify each issue as one of:

1. Blocking defect belonging to this task.
2. Separate backlog item.
3. Milestone-gated issue.
4. Unnecessary complexity or non-actionable finding.

Do not fix newly discovered issues yet.

## Wiring Recheck

Confirm:

- Every changed file’s inbound references.
- Every changed file’s outbound references.
- Any stale pointers created by the updates.
- Whether a single source of truth is still maintained.
- Whether NEXT-BUILD-PHASES.md must be updated.

## Scope and Risk Review

Confirm:

- No unrelated files were changed.
- No new dependency or architecture was introduced without approval.
- No live or destructive command is now required.
- No owner-gated item has been added implicitly.
- The remaining work is still the smallest safe implementation.

## Revised Plan

Return the revised remaining plan in execution order.

For every revised item, state:

- What will change.
- What will not change.
- How it will be verified.
- Whether it requires additional owner approval.

Stop after presenting the revised plan. Wait for approval before continuing implementation.`
},

{
  id: 'implement-approved-plan',
  title: 'Implement the Approved Plan',
  category: 'Implement',
  tags: ['stable build protocol', 'scope control', 'no commit'],
  description: 'Use this only after reviewing and approving Claude’s plan. It activates implementation while keeping the work limited to the approved scope.',
  body: `The inspection and implementation plan is approved. All required permissions are explicitly provided now. 

Proceed with implementation only.

Implement exactly the approved plan and nothing more.

Rules:

- Work only inside the current worktree.
- Do not modify unrelated files.
- Do not introduce new dependencies, services, frameworks, or architecture unless the approved plan explicitly requires them.
- Do not commit yet.
- Do not silently expand the scope when you discover unrelated issues.
- Verify stated success criteria has been met

After each meaningful change:

1. Inspect the diff.
2. Confirm that no unrelated files changed.
3. Run the narrowest relevant non-live test or validation.
4. Check for stale references and duplicate sources of truth.
5. Confirm that documentation pointers remain coherent.
6. Stop and report if the approved plan is no longer sufficient.

Use the existing project patterns, tools, and source-of-truth boundaries:

- CLAUDE.md owns command strings and universal session rules.
- ENVIRONMENT.md owns environment mechanisms.
- project/plans/NEXT-BUILD-PHASES.md owns current build state and next opportunities.
- project/plans/README.md is an index only.
- project/logs/decisions.md owns historical decisions and rationale.
- Detailed procedures belong in the relevant skill or referenced document.

When implementation is finished, do not claim completion yet. Return:

1. Files changed.
2. What changed in each file.
3. Tests or checks already run.
4. Remaining verification required.
5. Any unresolved issue or scope concern.

`
},

{
  id: 'verify-and-close-out',
  title: 'Verify and Close Out',
  category: 'Verify',
  tags: ['stable build protocol', 'verification', 'close-out', 'evidence'],
  description: 'Use this after implementation. It activates verification without allowing Claude to add new features or unrelated fixes.',
  body: `Implementation is complete. Begin verification and close-out only.

Do not add new features.
Do not perform unrelated cleanup.
Do not expand the approved scope.
Do not run live or destructive commands.
Do not commit unless separately instructed.

Run the smallest relevant test first, followed by the broader checks appropriate to this change.

For every check, report:

- Exact command.
- Whether it was actually run.
- Observed output or success signal.
- Classification:
  - PASS
  - KNOWN BASELINE FAILURE
  - FAIL
  - NOT RUN
- Whether the result blocks completion.

Treat a check as PASS only when its expected success signal is observed.

Treat a result as KNOWN BASELINE FAILURE only when it matches a previously documented environment-only failure and no new failure appears.

Then perform these close-out checks:

1. Review the complete git diff.
2. Run \`git status --short\`.
3. Confirm only approved files changed.
4. Search for stale references to renamed, retired, or phantom paths.
5. Confirm every removed fact was moved to its authoritative home, replaced with a valid pointer, or intentionally marked obsolete.
6. Confirm every touched document points to one current source of truth.
7. Confirm project/plans/NEXT-BUILD-PHASES.md was updated if project state changed.
8. Confirm the relevant decision entry states what remains.
9. Confirm no live or destructive command was executed.
10. Report all skipped checks and why they were skipped.

Return exactly these sections:

## Changed

List each changed file and its purpose.

## Verification

List every command, observed result, and classification.

## Wiring

Report updated references, stale-reference searches, and source-of-truth confirmation.

## Risks and Open Items

Report unresolved issues, whether they block completion, and any owner decision required.

## Next Build State

State what is complete, the next closest-to-finished opportunity, and its single blocking item.

Do not use the words “complete,” “verified,” or “ready” unless the evidence supports them.`
},

{
  id: 'create-a-checkpoint',
  title: 'Prompt 1 — Create a Checkpoint',
  category: 'Handoff',
  tags: [],
  description: 'Use this before ending the current session, even if the work is only partially complete.',
  body: `Create a resumable checkpoint now.

Do not make implementation changes.
Do not commit, stage, deploy, or run live or destructive commands.

Inspect the current repository and report:

## Task

- Original task:
- Success criteria:
- Owner approval:

## Current Phase

- Current phase:
- Step currently in progress:
- Exact point reached:

## Verified Complete

- Completed steps:
- Evidence for each completed step:
- Tests or commands run:
- Results:

## Partially Complete

For each partially completed item:

- File:
- Changes already made:
- Changes still required:
- Whether the partial change is safe to keep:
- Recommended next action:

## Not Started

- Remaining approved steps:

## Current Worktree

- Current branch:
- Current worktree:
- Modified files:
- Untracked files:
- Staged files:
- Merge conflicts:
- Related worktrees:

## Verification

- Checks already run:
- Results:
- Known baseline failures:
- Checks still required:

## Scope and Approval

- Approved work remaining:
- Newly discovered issues:
- Live or destructive actions still gated:
- Owner decisions still needed:

## Exact Next Action

State one concrete next action for the next session.

Do not claim the task is complete unless all success criteria and required verification have been satisfied.

End with:

“Checkpoint complete. No new implementation changes were made.”`
},

{
  id: 'prompt-2-resume-in-the-next-session',
  title: 'Prompt 2 — Resume in the Next Session',
  category: 'Handoff',
  tags: [],
  description: 'Paste this at the beginning of the next session along with the checkpoint from Prompt 1.',
  fields: {
    'TASK': { label: 'Task', type: 'text' },
    'CRITERIA': { label: 'Criteria', type: 'text' },
    'APPROVAL': { label: 'Approval', type: 'text' },
    'PASTE THE CHECKPOINT HERE': { label: 'Paste The Checkpoint Here', type: 'textarea' }
  },
  body: `Resume work from the checkpoint below.

Treat the repository and git state as authoritative. Treat the checkpoint as context only. Verify every important claim against the actual files and git diff.

## Original Task

[TASK]

## Success Criteria

[CRITERIA]

## Owner Approval

[APPROVAL]

## Previous Checkpoint

[PASTE THE CHECKPOINT HERE]

## Safety Rules

Begin with inspection only.

Do not edit, create, delete, move, rename, reset, restore, stage, commit, deploy, send, migrate, repair, or run destructive commands yet.

Do not run live commands.

Never run:

- \`git add -A\`
- \`git add .\`
- Force-push or history rewriting.
- Live \`railway run\` commands.
- Production or staging migrations.
- Database reset, drop, repair, or deletion.
- Live sending or attachment commands.

## Reconstruct the Current State

Inspect and report:

1. Current branch and worktree.
2. \`git status --short\`.
3. Modified, untracked, staged, deleted, or conflicted files.
4. Relevant diff.
5. Whether the checkpoint matches the repository.
6. What is actually complete.
7. What is partially complete.
8. What remains.
9. Whether any changes appear unrelated.
10. Whether the worktree is safe to continue.

Read the relevant source-of-truth documents, including:

- \`CLAUDE.md\`
- \`ENVIRONMENT.md\`
- \`project/plans/NEXT-BUILD-PHASES.md\`
- Relevant architecture and skill documents
- Relevant decision records

## Revised Resume Plan

Return:

### Confirmed Complete

List completed work with evidence.

### Partially Complete

List partial work, what remains, and whether it is safe to keep.

### Remaining Approved Work

List only the work still required for the original task.

### Unrelated or Uncertain Changes

List them without reverting or deleting anything.

### Verification Plan

List the exact checks required and their expected success signals.

### Gated Actions

List any live, destructive, irreversible, or owner-only actions. Mark them as not approved.

### Resume Decision

Classify the state as:

- Safe to continue.
- Needs a revised plan.
- Blocked by a conflict.
- Requires owner approval.
- Complete pending verification.

Do not edit files yet.

End with:

“State reconstructed. No files were changed. Waiting for explicit approval to resume the remaining approved work.”`
},

{
  id: 'general',
  title: 'General',
  category: 'Add-On',
  tags: [],
  description: 'Clarify with cards',
  body: `Ask in simple cards with recommended top 2 options, with context and clear and brief explanation with pros and cons of the top answers`
},

{
  id: 'start-new-session-continued-from-handoff',
  title: 'Start New Session Continued From Handoff/QA',
  category: 'Handoff',
  tags: ['Start New Session'],
  body: `Start build from last handoff, i want the final product to be assess by a separate QA which assesses its final accurate and functionality and gives a simple summarized point form report, assess accuracy against the original plan, and summarize where matches and where deviates and where is ambiguous. Any questiosn required answer from the user ask in simple questions with explained brief but important context, give best 2 options with pros and cons of each.`
},

{
  id: 'qa-test-suite',
  title: 'QA Test Suite',
  category: 'QA',
  tags: [],
  body: `I want the final product to be assess by a separate QA which assesses its final accurate and functionality and gives a simple summarized point form report, assess accuracy against the original plan, and summarize where matches and where deviates and where is ambiguous. Any questiosn required answer from the user ask in simple questions with explained brief but important context, give best 2 options with pros and cons of each.`
},

{
  id: 'check-current-project-location',
  title: 'Project Location & Status Snapshot',
  category: 'Git',
  tags: ['git', 'location', 'powershell'],
  description: 'Shows my current folder, Git root, branch, and file status.',
  body: `Write-Host "\`nCURRENT FOLDER:"
(Get-Location).Path

Write-Host "\`nGIT REPOSITORY ROOT:"
git rev-parse --show-toplevel

Write-Host "\`nCURRENT BRANCH:"
git branch --show-current

Write-Host "\`nFILE STATUS:"
git status`
},

{
  id: 'git-add-one-file',
  title: 'Git Add One File',
  category: 'Git',
  tags: ['add', 'stage', 'file', 'safe'],
  description: 'Stages one selected file for commit.',
  fields: {
    'FILE_PATH': { label: 'File_path', type: 'text' }
  },
  body: `Write-Host "\`n[1] ADD ONE FILE"
Write-Host "Stages the selected file."
git add "[FILE_PATH]"`
},

{
  id: 'git-add-one-folder',
  title: 'Git Add One Folder',
  category: 'Git',
  tags: ['add', 'stage', 'folder', 'directory'],
  description: 'Stages changes inside one selected folder.',
  fields: {
    'FOLDER_PATH': { label: 'Folder_path', type: 'text' }
  },
  body: `Write-Host "\`n[2] ADD ONE FOLDER"
Write-Host "Stages changes inside the selected folder."
git add "[FOLDER_PATH]"`
},

{
  id: 'git-add-current-folder',
  title: 'Git Add Current Folder',
  category: 'Git',
  tags: ['add', 'stage', 'current folder', 'period'],
  description: 'Stages changes below the current folder.',
  body: `Write-Host "\`n[3] ADD CURRENT FOLDER"
Write-Host "Stages changes inside the current folder."
git add .`
},

{
  id: 'git-add-everything-warning',
  title: 'Git Add Everything (WARNING)',
  category: 'Git',
  tags: ['add all', 'stage all', 'warning', 'deleted files'],
  description: 'Stages every new, modified, and deleted file.',
  fields: {
    'CONFIRMATION': { label: 'Confirmation', type: 'text' }
  },
  body: `Write-Host "\`n[4] ADD EVERYTHING"
Write-Host "WARNING: This stages all new, modified, and deleted files."
git status
$CONFIRMATION = "[CONFIRMATION]"
if ($CONFIRMATION -eq "YES") {
    git add -A
    git status
} else {
    Write-Host "Skipped git add -A"
}`
},

{
  id: 'git-commit-with-message',
  title: 'Git Review Staged Changes',
  category: 'Git',
  tags: ['diff', 'staged', 'review', 'before commit'],
  description: 'Shows exactly what will be committed.',
  body: `Write-Host "\`n[7] REVIEW STAGED CHANGES"
Write-Host "Shows exactly what will be included in the next commit."
git diff --cached`
},

{
  id: 'git-commit-with-message-2',
  title: 'Git Commit With Message',
  category: 'Git',
  tags: ['commit', 'message', 'save', 'checkpoint'],
  description: 'Saves staged changes as a local commit.',
  fields: {
    'COMMIT_MESSAGE': { label: 'Commit_message', type: 'text' }
  },
  body: `Write-Host "\`n[5] COMMIT CHANGES"
Write-Host "Saves staged changes as a local checkpoint."
git commit -m "[COMMIT_MESSAGE]"`
},

{
  id: 'git-view-commit-history',
  title: 'Git View Commit History',
  category: 'Git',
  tags: ['log', 'history', 'commits', 'records'],
  description: 'Shows recent commits.',
  body: `Write-Host "\`n[8] COMMIT HISTORY"
Write-Host "Shows the five most recent commits."
git log --oneline -5`
},

{
  id: 'git-push-to-github',
  title: 'Git Push To GitHub',
  category: 'Git',
  tags: ['push', 'upload', 'GitHub', 'remote'],
  description: 'Uploads local commits to GitHub.',
  body: `Write-Host "\`n[10] PUSH TO GITHUB"
Write-Host "Uploads local commits to GitHub."
git push`
},

{
  id: 'git-pull-from-github',
  title: 'Git Pull From GitHub',
  category: 'Git',
  tags: ['pull', 'download', 'GitHub', 'sync'],
  description: 'Downloads changes from GitHub.',
  body: `Write-Host "\`n[11] PULL FROM GITHUB"
Write-Host "Downloads and integrates changes from GitHub."
git pull`
},

{
  id: 'git-undo-staging',
  title: 'Git Undo Staging',
  category: 'Git',
  tags: ['unstage', 'undo', 'staged', 'restore'],
  description: 'Removes a file from staging without deleting it.',
  fields: {
    'FILE_PATH': { label: 'File_path', type: 'text' }
  },
  body: `Write-Host "\`n[12] UNSTAGE ONE FILE"
Write-Host "Removes the file from staging but keeps your changes."
git restore --staged "[FILE_PATH]"`
},

{
  id: 'git-safe-commit-review',
  title: 'Git Safe Commit Review',
  category: 'Git',
  tags: ['safe commit', 'review', 'status', 'diff'],
  description: 'Reviews changes before committing.',
  body: `Write-Host "\`n[13] SAFE COMMIT REVIEW"
Write-Host "Reviews your files before creating a commit."
git status
git diff
git diff --cached`
}

]);
