# CI/CD Configuration

This directory contains GitHub Actions workflows for automated testing, security scanning, deployment, and quality assurance.

## 🔄 Workflows Overview

### 🧪 Testing & Quality

- **[testing.yml](testing.yml)** - Comprehensive test suite execution
- **[static-analysis.yml](static-analysis.yml)** - Code quality and static analysis
- **[quality-gate.yml](quality-gate.yml)** - Quality gate enforcement for PRs

### 🔒 Security & Compliance

- **[security.yml](security.yml)** - Security vulnerability scanning and CodeQL analysis
- **[dependencies.yml](dependencies.yml)** - Dependency management and license compliance

### 🚀 Deployment

- **[deploy.yml](deploy.yml)** - Build and deployment pipeline
- **[docs.yml](docs.yml)** - Documentation building and deployment

## 📊 Workflow Triggers

### On Every Push/Pull Request

```yaml
on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main, develop]
```

### Scheduled Jobs

```yaml
# Security scans - Daily at 2 AM UTC
schedule:
  - cron: '0 2 * * *'

# Dependency updates - Weekly on Monday at 6 AM UTC
schedule:
  - cron: '0 6 * * 1'
```

## 🔑 Required Secrets

Configure these repository secrets:

### Security Scanning

- `SNYK_TOKEN` - Snyk vulnerability scanner token
- `SLACK_WEBHOOK_URL` - Slack notifications (optional)

### Deployment

- `GITHUB_TOKEN` - Automatic (provided by GitHub)
- Custom deployment secrets (if using external hosting)

## 📋 Quality Gates

### Coverage Requirements

- **Test Coverage**: ≥ 90%
- **Bundle Size**: ≤ 1MB
- **ESLint Errors**: 0
- **TypeScript Errors**: 0

### Security Thresholds

- **npm Audit**: Fail on high severity, warn on moderate
- **Snyk**: Fail on high severity vulnerabilities
- **CodeQL**: Automatic security analysis

## 🚀 Deployment Strategy

### Pull Request Preview

```yaml
deploy-preview:
  # Deploys to https://jericho.app/preview-{PR_NUMBER}
  # Automatic cleanup when PR merged/closed
```

### Production Deployment

```yaml
deploy-production:
  # Deploys main branch to https://jericho.app
  # Requires manual approval via GitHub Environments
```

## 🔧 Configuration Files

### ESLint Configuration

```json
{
  "extends": ["@typescript-eslint/recommended"],
  "rules": {
    "no-console": "warn",
    "prefer-const": "error"
  }
}
```

### Prettier Configuration

```json
{
  "semi": true,
  "trailingComma": "es5",
  "singleQuote": true,
  "printWidth": 80
}
```

### TypeScript Configuration

```json
{
  "compilerOptions": {
    "strict": true,
    "noEmit": true,
    "skipLibCheck": true
  }
}
```

## 📈 Workflow Metrics

### Performance Benchmarks

- **Build Time**: < 3 minutes
- **Test Execution**: < 2 minutes
- **Security Scan**: < 5 minutes
- **Total Pipeline**: < 10 minutes

### Artifact Storage

- **Build Artifacts**: 30 days retention
- **Test Results**: 30 days retention
- **Security Reports**: 90 days retention
- **Quality Reports**: 30 days retention

## 🛠️ Local Development

### Running Workflows Locally

```bash
# Install Act for local GitHub Actions testing
brew install act

# Run all workflows
act

# Run specific workflow
act -j test
```

### Quality Gates Locally

```bash
# Run all quality checks
npm run check-all

# Individual checks
npm run typecheck
npm run lint
npm test -- --coverage
npm run build
npm audit
```

## 🔍 Troubleshooting

### Common Issues

#### Build Failures

```bash
# Clear build cache
rm -rf node_modules package-lock.json
npm install

# Check TypeScript compilation
npx tsc --noEmit
```

#### Test Failures

```bash
# Run specific failing test
npm test -- --grep "test name"

# Run tests with verbose output
npm test -- --reporter=verbose
```

#### Security Scan Failures

```bash
# Check vulnerabilities manually
npm audit --json

# Fix moderate issues automatically
npm audit fix
```

### Debugging Workflows

#### Enable Debug Logging

```yaml
env:
  ACTIONS_STEP_DEBUG: true
  ACTIONS_RUNNER_DEBUG: true
```

#### Artifact Download

```bash
# Download workflow artifacts
gh run download RUN_ID
```

## 📚 Additional Resources

- [GitHub Actions Documentation](https://docs.github.com/en/actions)
- [ESLint Configuration](https://eslint.org/docs/latest/user-guide/configuring)
- [Prettier Configuration](https://prettier.io/docs/en/configuration)
- [TypeScript Configuration](https://www.typescriptlang.org/tsconfig)

## 🤝 Contributing to CI/CD

When modifying workflows:

1. **Test locally** using `act`
2. **Update this README** with changes
3. **Consider performance impact** of new checks
4. **Maintain backward compatibility** where possible
5. **Document new secrets** if required

This CI/CD setup ensures code quality, security, and reliable deployment for the JERICHO project. 🎯
