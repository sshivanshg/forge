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

export const ROLLOUT_MODES = ["BLUE_GREEN", "CANARY"] as const;
export type RolloutMode = (typeof ROLLOUT_MODES)[number];
export const MAX_REPLICAS = 3;

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
  /** Identical instances behind the load balancer (1–3). */
  replicas: number;
  rollout: RolloutMode;
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

export type UpdateProjectInput = Partial<Omit<CreateProjectInput, "slug">> & {
  replicas?: number;
  rollout?: RolloutMode;
};

export interface EnvVar {
  key: string;
  valuePreview: string;
  updatedAt: ISODate;
}

// ---------------------------------------------------------------- Deployments

/** Every step a deployment can pass through; CANARY only in canary rollouts. */
export const ALL_PIPELINE_STEPS = ["QUEUED", "BUILDING", "DEPLOYING", "HEALTH_CHECKING", "CANARY", "LIVE"] as const;
export type PipelineStep = (typeof ALL_PIPELINE_STEPS)[number];
/** The steps of a blue-green rollout (the default). */
export const PIPELINE_STEPS: readonly PipelineStep[] = ALL_PIPELINE_STEPS.filter((s) => s !== "CANARY");

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
  | "CANARY_REGRESSION"
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
  /** The new version's share of the traffic while in CANARY, else null. */
  trafficPercent: number | null;
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
