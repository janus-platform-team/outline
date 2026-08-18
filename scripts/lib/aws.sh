#!/usr/bin/env bash

# Shared AWS credential and region resolution for the ECR scripts.
#
# Credentials resolve in this order:
#   1. AWS_PROFILE set to a non-empty value selects that named profile.
#   2. AWS_PROFILE set to an empty value forces the ambient credential chain,
#      which is how EC2 instance roles and ECS task roles authenticate.
#   3. AWS_PROFILE unset selects DEFAULT_AWS_PROFILE when that profile is
#      configured locally, and otherwise falls back to the ambient chain.
#
# This lets the same script work unchanged on a workstation using a named
# profile and on an EC2 instance that only has an attached role.

DEFAULT_AWS_PROFILE="${DEFAULT_AWS_PROFILE:-internal-tools}"
AWS_REGION_NAME="${AWS_REGION:-us-east-1}"

# Fails with a readable message when a required binary is missing.
require_command() {
  local command_name="$1"

  if ! command -v "$command_name" >/dev/null 2>&1; then
    echo "Required command not found: $command_name" >&2
    exit 1
  fi
}

# Prints the profile to use, or nothing to use the ambient credential chain.
resolve_aws_profile() {
  if [[ -n "${AWS_PROFILE:-}" ]]; then
    printf '%s' "$AWS_PROFILE"
    return
  fi

  # A set-but-empty AWS_PROFILE is an explicit opt-in to the ambient chain.
  if [[ -n "${AWS_PROFILE+set}" ]]; then
    return
  fi

  if aws configure list-profiles 2>/dev/null | grep -qx "$DEFAULT_AWS_PROFILE"; then
    printf '%s' "$DEFAULT_AWS_PROFILE"
  fi
}

# Runs the AWS CLI with the resolved profile and region applied.
aws_cli() {
  if [[ -n "$AWS_PROFILE_NAME" ]]; then
    aws --profile "$AWS_PROFILE_NAME" --region "$AWS_REGION_NAME" "$@"
    return
  fi

  aws --region "$AWS_REGION_NAME" "$@"
}

# Describes which credentials are in use, so failures are easy to diagnose.
describe_credential_source() {
  if [[ -n "$AWS_PROFILE_NAME" ]]; then
    echo "Authenticating with AWS profile \"${AWS_PROFILE_NAME}\" in ${AWS_REGION_NAME}"
    return
  fi

  echo "Authenticating with ambient AWS credentials (instance role, task role, or environment) in ${AWS_REGION_NAME}"
}

# Prints the account id for the resolved credentials.
resolve_account_id() {
  local account_id

  if ! account_id="$(aws_cli sts get-caller-identity --query Account --output text 2>/dev/null)"; then
    echo "Unable to resolve AWS credentials." >&2
    echo "Set AWS_PROFILE to a configured profile, export AWS_PROFILE= to use an" >&2
    echo "instance role, or attach a role to this instance." >&2
    exit 1
  fi

  printf '%s' "$account_id"
}

require_command aws

AWS_PROFILE_NAME="$(resolve_aws_profile)"
