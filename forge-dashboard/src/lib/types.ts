// Shapes returned by forge-server (/api/v1). The Spring controllers are the source of truth.

export type UUID = string;
export type ISODate = string;

export interface User {
  id: UUID;
  email: string;
  displayName: string;
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface Page<T> {
  content: T[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
}

/** RFC 9457 problem detail, enriched by forge-server with `code` and `correlationId`. */
export interface ProblemDetail {
  type?: string;
  title?: string;
  status: number;
  detail?: string;
  instance?: string;
  code?: string;
  correlationId?: string;
  errors?: { field: string; message: string }[];
}

// ---------------------------------------------------------------- GitHub

export interface GitHubConnection {
  connected: boolean;
  login: string | null;
  oauthConfigured: boolean;
}

export interface GitHubRepo {
  owner: string;
  name: string;
  fullName: string;
  defaultBranch: string;
  isPrivate: boolean;
}

// ---------------------------------------------------------------- Projects

export const BUILD_TYPES = ["AUTO", "DOCKERFILE", "MAVEN", "GRADLE", "NODE"] as const;
export type BuildType = (typeof BUILD_TYPES)[number];

export interface Project {
  id: UUID;
  name: string;
  slug: string;
  repoOwner: string;
  repoName: string;
  repoUrl: string;
  branch: string;
  rootDir: string;
  buildType: BuildType;
  port: number;
  healthCheckPath: string;
  autoDeploy: boolean;
  /** Always computed from the slug; only reachable when liveDeploymentId is set. */
  liveUrl: string;
  liveDeploymentId: UUID | null;
  createdAt: ISODate;
  updatedAt: ISODate;
}

export interface CreateProjectInput {
  name: string;
  slug?: string;
  repoOwner: string;
  repoName: string;
  branch?: string;
  rootDir?: string;
  buildType?: BuildType;
  port?: number;
  healthCheckPath?: string;
  autoDeploy?: boolean;
}

export type UpdateProjectInput = Partial<Omit<CreateProjectInput, "slug">>;

export interface EnvVar {
  key: string;
  valuePreview: string;
  updatedAt: ISODate;
}

// ---------------------------------------------------------------- Deployments

export const PIPELINE_STEPS = ["QUEUED", "BUILDING", "DEPLOYING", "HEALTH_CHECKING", "LIVE"] as const;
export type PipelineStep = (typeof PIPELINE_STEPS)[number];

export type DeploymentStatus =
  | PipelineStep
  | "FAILED"
  | "CANCELLED"
  | "SUPERSEDED"
  | "STOPPED";

export type FailureReason =
  | "SOURCE_UNAVAILABLE"
  | "UNSUPPORTED_PROJECT"
  | "BUILD_FAILED"
  | "BUILD_TIMEOUT"
  | "PUSH_FAILED"
  | "RUNTIME_ERROR"
  | "UNHEALTHY"
  | "INTERNAL_ERROR";

export type DeploymentTrigger = "MANUAL" | "WEBHOOK" | "ROLLBACK" | "RECOVERY";

export interface TimelineEntry {
  from: DeploymentStatus | null;
  to: DeploymentStatus;
  message: string | null;
  at: ISODate;
}

export interface Deployment {
  id: UUID;
  projectId: UUID;
  commitSha: string | null;
  commitMessage: string | null;
  trigger: DeploymentTrigger;
  status: DeploymentStatus;
  failureReason: FailureReason | null;
  failureDetail: string | null;
  imageRef: string | null;
  rollbackOfId: UUID | null;
  createdAt: ISODate;
  startedAt: ISODate | null;
  finishedAt: ISODate | null;
  timeline: TimelineEntry[] | null;
}

export type LogSource = "BUILD" | "DEPLOY" | "RUNTIME" | "SYSTEM";

export interface LogLine {
  seq: number;
  source: LogSource;
  line: string;
  ts: ISODate;
}

export interface RuntimeLogLine {
  line: string;
  ts: ISODate;
}

export type Confidence = "LOW" | "MEDIUM" | "HIGH";

/** The Forge agent's diagnosis of a failed deployment. */
export interface Insight {
  deploymentId: UUID;
  category: string;
  summary: string;
  suggestedFix: string;
  confidence: Confidence;
  engine: string;
  evidence: string[];
  createdAt: ISODate;
}
