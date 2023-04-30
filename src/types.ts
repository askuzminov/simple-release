import { parse } from './parser';
import { getRepo } from './utils';

export type Pack = Record<string, string | undefined | Record<string, string | undefined>>;

export interface GithubReleaseData {
  tag_name: string;
  name?: string;
  body?: string;
  prerelease?: boolean;
}

export interface GithubRelease {
  token: string;
  path: string;
  setup: GithubReleaseData;
}

export interface GitlabReleaseData {
  name?: string;
  tag_name: string;
  description?: string;
}

export interface GitlabRelease {
  domain: string;
  token: string;
  projectID: string;
  setup: GitlabReleaseData;
}

export interface RawLog {
  short: string;
  hash: string;
  title: string;
  body: string;
}

export interface Message {
  type: string;
  scope?: string;
  content: string;
  body: string;
  hash: string;
  shortHash: string;
  major: boolean;
}

export interface Markdown {
  config: ParseConfig;
  tag: string;
  version: string;
  date: string;
  url: string;
}

export type ParseConfig = ReturnType<typeof parse>;
export type Repo = ReturnType<typeof getRepo>;
