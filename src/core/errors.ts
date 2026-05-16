export class RepoGuideError extends Error {
  readonly exitCode: number;

  constructor(message: string, exitCode = 2) {
    super(message);
    this.name = 'RepoGuideError';
    this.exitCode = exitCode;
  }
}

export function isRepoGuideError(error: unknown): error is RepoGuideError {
  return error instanceof RepoGuideError;
}
