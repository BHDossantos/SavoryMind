# Plan 5-3 — GitHub Actions workflow

<plan>
  <name>Run DealFlow tests in CI on push/PR</name>
  <wave>2</wave>
  <depends_on>5-1 (npm test must exist)</depends_on>
  <files>
    <write>.github/workflows/dealflow-tests.yml</write>
  </files>
  <action>
    1. Trigger:
       - push: branches matching `claude/dealflow-**` and `main`, paths-filter `dealflow/**`
       - pull_request: paths-filter `dealflow/**`
    2. Single job, ubuntu-latest, Node 20:
       - actions/checkout@v4
       - actions/setup-node@v4 with node-version 20 and cache 'npm', cache-dependency-path 'dealflow/package-lock.json'
       - working-directory: dealflow
       - npm ci
       - npm test
    3. Do not break the existing root-level CI for SavoryMind (separate workflow file).
  </action>
  <verify>
    - YAML parses (validate locally with a quick `yq` or just visual review)
    - Workflow only triggers when dealflow/** changes
    - Job uses Node 20 and the dealflow/ working dir
  </verify>
  <done>
    - .github/workflows/dealflow-tests.yml committed
    - Branch push triggers the workflow on the next commit
  </done>
</plan>
