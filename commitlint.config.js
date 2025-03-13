export default {
  extends: ['@commitlint/config-conventional'],
  // type(scope?): subject <-- this is the format of a commit message
  rules: {
    'type-enum': [
      2,
      'always',
      // The types of commit messages that are allowed
      [
        'feat',
        'fix',
        'docs',
        'style',
        'refactor',
        'test',
        'chore',
        'build',
        'perf',
        'ci',
        'revert',
      ],
    ],
    'subject-case': [0, 'never'], // Allow any case in commit message subject
  },
};
