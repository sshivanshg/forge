"use client";

import { Field, Input, Select, Toggle } from "@/components/ui/Input";
import { BUILD_TYPES, type BuildType } from "@/lib/types";

export interface BuildSettingsValues {
  rootDir: string;
  buildType: BuildType;
  port: string;
  healthCheckPath: string;
  autoDeploy: boolean;
}

export const DEFAULT_BUILD_SETTINGS: BuildSettingsValues = {
  rootDir: ".",
  buildType: "AUTO",
  port: "8080",
  healthCheckPath: "/",
  autoDeploy: true,
};

const BUILD_TYPE_HINT: Record<BuildType, string> = {
  AUTO: "Detect from the repo (Dockerfile, pom.xml, build.gradle, package.json).",
  DOCKERFILE: "Build the Dockerfile in the root directory.",
  MAVEN: "Package with Maven and run the resulting jar.",
  GRADLE: "Build with Gradle and run the resulting jar.",
  NODE: "npm install, npm run build, npm start.",
};

interface Props {
  values: BuildSettingsValues;
  onChange: (patch: Partial<BuildSettingsValues>) => void;
  errors: Record<string, string>;
  idPrefix?: string;
}

/** Root dir, build type, port, health path and auto-deploy - shared by "new project" and project settings. */
export function BuildSettingsFields({ values, onChange, errors, idPrefix = "bs" }: Props) {
  const id = (name: string) => `${idPrefix}-${name}`;
  return (
    <div className="space-y-5">
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Root directory" htmlFor={id("rootDir")} error={errors.rootDir} hint="Relative to the repository root.">
          <Input
            id={id("rootDir")}
            className="font-mono"
            value={values.rootDir}
            onChange={(e) => onChange({ rootDir: e.target.value })}
            invalid={!!errors.rootDir}
            placeholder="."
          />
        </Field>
        <Field label="Build type" htmlFor={id("buildType")} error={errors.buildType} hint={BUILD_TYPE_HINT[values.buildType]}>
          <Select
            id={id("buildType")}
            value={values.buildType}
            onChange={(e) => onChange({ buildType: e.target.value as BuildType })}
            invalid={!!errors.buildType}
          >
            {BUILD_TYPES.map((t) => (
              <option key={t} value={t}>
                {t === "AUTO" ? "Auto-detect" : t.charAt(0) + t.slice(1).toLowerCase()}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Port" htmlFor={id("port")} error={errors.port} hint="The port your app listens on inside the container.">
          <Input
            id={id("port")}
            className="font-mono"
            inputMode="numeric"
            value={values.port}
            onChange={(e) => onChange({ port: e.target.value.replace(/[^0-9]/g, "") })}
            invalid={!!errors.port}
            placeholder="8080"
          />
        </Field>
        <Field
          label="Health check path"
          htmlFor={id("healthCheckPath")}
          error={errors.healthCheckPath}
          hint="Must answer 2xx before traffic switches over."
        >
          <Input
            id={id("healthCheckPath")}
            className="font-mono"
            value={values.healthCheckPath}
            onChange={(e) => onChange({ healthCheckPath: e.target.value })}
            invalid={!!errors.healthCheckPath}
            placeholder="/"
          />
        </Field>
      </div>
      <Toggle
        id={id("autoDeploy")}
        checked={values.autoDeploy}
        onChange={(autoDeploy) => onChange({ autoDeploy })}
        label="Auto-deploy"
        description="Deploy automatically when commits are pushed to the branch (GitHub webhook)."
      />
    </div>
  );
}

/** Client-side checks mirroring the server's bean validation. */
export function validateBuildSettings(v: BuildSettingsValues): Record<string, string> {
  const errors: Record<string, string> = {};
  const port = Number(v.port);
  if (!v.port || !Number.isInteger(port) || port < 1 || port > 65535) errors.port = "Enter a port between 1 and 65535.";
  if (v.healthCheckPath && !v.healthCheckPath.startsWith("/")) errors.healthCheckPath = "Must start with /.";
  return errors;
}
