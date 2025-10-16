import { RuleConfigSeverity } from '@commitlint/types'

export default {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'type-enum': [
      RuleConfigSeverity.Error,
      'always',
      [
        'feat',
        'fix',
        'docs',
        'style',
        'refactor',
        'perf',
        'test',
        'build',
        'ci',
        'chore',
        'revert',
        'release',
      ],
    ],
    'subject-empty': [RuleConfigSeverity.Error, 'never'],
    'subject-full-stop': [RuleConfigSeverity.Error, 'never', '.'],
    'subject-case': [RuleConfigSeverity.Disabled],
    'type-empty': [RuleConfigSeverity.Error, 'never'],
    'type-case': [RuleConfigSeverity.Error, 'always', 'lower-case'],
  },
}
