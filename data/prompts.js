/* ---------------------------------------------------------------------------
   THE LIBRARY LIVES HERE.

   Add a prompt = add an object to the array below, save, commit, push.
   Every device gets it on the next load. No build step, no database.

   Fields (fill-in-the-blanks) are written [IN SQUARE BRACKETS] inside `body`.
   They are detected automatically; the optional `fields` map below just gives
   them nicer labels, input types and defaults.

     id          unique slug — also the shareable #/p/<id> link
     title       shown in the list
     category    one bucket per prompt (drives the sidebar)
     tags        any number, searchable
     description when to reach for this prompt
     fields      optional metadata, keyed by the exact bracket text
                   label, hint, type: 'text' | 'textarea' | 'select',
                   options: [...] (for select), default, rows
     body        the prompt itself

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
    'APPROVAL OR NONE': { label: 'Owner approval', type: 'text', default: 'NONE', hint: 'Name the approval, or leave as NONE.' }
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
    'PASTE YOUR ANSWERS HERE': {
      label: 'Clarifications and corrections',
      type: 'textarea',
      rows: 8,
      hint: 'Your answers to Claude’s questions, or corrections to its assumptions.'
    }
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
    'PASTE THE APPROVED PLAN OR SUMMARIZE IT': {
      label: 'Original approved plan',
      type: 'textarea', rows: 8,
      hint: 'Paste it in full, or summarise it.'
    },
    'LIST UPDATES, OR ASK CLAUDE TO DETERMINE THEM FROM THE DIFF': {
      label: 'Updates already made',
      type: 'textarea',
      default: 'Determine them from the diff.',
      hint: 'List them, or leave the default and let Claude read the diff.'
    }
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
  body: `The inspection and implementation plan is approved.

Proceed with implementation only.

Implement exactly the approved plan and nothing more.

Rules:

- Work only inside the current worktree.
- Do not modify unrelated files.
- Do not introduce new dependencies, services, frameworks, or architecture unless the approved plan explicitly requires them.
- Do not run live or destructive commands.
- Do not run railway commands, live sending, production migrations, database resets, repairs, deletions, or credential cleanup.
- Do not run git add -A or git add ..
- Do not commit yet.
- Do not force-push or bypass any guard.
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
5. Any unresolved issue or scope concern.`
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
}

]);
