/**
 * Minimal GitHub client: commit a set of files to the repo in ONE commit (Git Data API: blobs → tree → commit → ref).
 * Used by /model add so a model's research lands in models/<slug>/ in GitHub, which Railway then redeploys.
 * Needs a fine-grained PAT with Contents: read/write on this repo (GITHUB_TOKEN); no npm dependency.
 */
export interface RepoFile {
  path: string; // repo-relative, e.g. models/jane/model.yaml
  content: string | null; // null = delete the file
}

export class GitHub {
  private base: string;
  constructor(private token: string, private repo: string, private branch = 'main') {
    this.base = `https://api.github.com/repos/${repo}`;
  }

  get enabled() {
    return Boolean(this.token && this.repo);
  }

  private async api<T>(path: string, init: RequestInit = {}): Promise<T> {
    const res = await fetch(`${this.base}${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${this.token}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        'Content-Type': 'application/json',
        ...(init.headers ?? {}),
      },
    });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error(`GitHub ${init.method ?? 'GET'} ${path} → ${res.status}: ${body.slice(0, 300)}`);
    }
    return (await res.json()) as T;
  }

  /** Does a path exist on the branch? */
  async exists(path: string): Promise<boolean> {
    const res = await fetch(`${this.base}/contents/${encodeURI(path)}?ref=${this.branch}`, {
      headers: { Authorization: `Bearer ${this.token}`, Accept: 'application/vnd.github+json' },
    });
    return res.status === 200;
  }

  /** Read a text file from the branch, or undefined. */
  async read(path: string): Promise<string | undefined> {
    const res = await fetch(`${this.base}/contents/${encodeURI(path)}?ref=${this.branch}`, {
      headers: { Authorization: `Bearer ${this.token}`, Accept: 'application/vnd.github.raw+json' },
    });
    if (res.status === 404) return undefined;
    if (!res.ok) throw new Error(`GitHub read ${path} → ${res.status}`);
    return res.text();
  }

  /** All file paths under a directory on the branch (recursive). */
  async listDir(dir: string): Promise<string[]> {
    const ref = await this.api<{ object: { sha: string } }>(`/git/ref/heads/${this.branch}`);
    const commit = await this.api<{ tree: { sha: string } }>(`/git/commits/${ref.object.sha}`);
    const tree = await this.api<{ tree: { path: string; type: string }[] }>(`/git/trees/${commit.tree.sha}?recursive=1`);
    const prefix = dir.replace(/\/$/, '') + '/';
    return tree.tree.filter((t) => t.type === 'blob' && t.path.startsWith(prefix)).map((t) => t.path);
  }

  /** One commit with all files (created, replaced, or deleted when content is null). Returns the commit sha. */
  async commitFiles(files: RepoFile[], message: string): Promise<string> {
    if (!files.length) throw new Error('nothing to commit');
    const ref = await this.api<{ object: { sha: string } }>(`/git/ref/heads/${this.branch}`);
    const head = ref.object.sha;
    const headCommit = await this.api<{ tree: { sha: string } }>(`/git/commits/${head}`);

    const tree = await Promise.all(
      files.map(async (f) => {
        if (f.content === null) return { path: f.path, mode: '100644', type: 'blob', sha: null }; // deletion
        const blob = await this.api<{ sha: string }>('/git/blobs', { method: 'POST', body: JSON.stringify({ content: f.content, encoding: 'utf-8' }) });
        return { path: f.path, mode: '100644', type: 'blob', sha: blob.sha };
      }),
    );
    const newTree = await this.api<{ sha: string }>('/git/trees', { method: 'POST', body: JSON.stringify({ base_tree: headCommit.tree.sha, tree }) });
    const commit = await this.api<{ sha: string }>('/git/commits', { method: 'POST', body: JSON.stringify({ message, tree: newTree.sha, parents: [head] }) });
    await this.api(`/git/refs/heads/${this.branch}`, { method: 'PATCH', body: JSON.stringify({ sha: commit.sha, force: false }) });
    return commit.sha;
  }
}
