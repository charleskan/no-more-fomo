#!/bin/bash
# Deploy no-more-fomo HTML pages to an S3 static website.
#
# Usage:
#   BUCKET=my-bucket bash scripts/deploy-s3.sh
#   BUCKET=my-bucket AWS_PROFILE=fomo-deploy AWS_DEFAULT_REGION=us-east-1 bash scripts/deploy-s3.sh
#
# Configuration (env vars, or via deploy.s3 in ~/.no-more-fomo/config.yaml):
#   BUCKET              (required) S3 bucket set up for static website hosting
#   AWS_PROFILE         (optional) IAM profile to deploy with — use a scoped user
#                       whose policy only grants S3 on this one bucket,
#                       never root/admin credentials
#   AWS_DEFAULT_REGION  (optional) bucket region, default us-east-1
#   SRC                 (optional) digest folder, default ~/no-more-fomo
#
# One-time bucket setup commands are at the bottom.

set -e

: "${BUCKET:?Set BUCKET to your S3 static-website bucket name}"
: "${AWS_DEFAULT_REGION:=us-east-1}"
: "${SRC:=$HOME/no-more-fomo}"
export AWS_DEFAULT_REGION
[ -n "$AWS_PROFILE" ] && export AWS_PROFILE

echo "Identity: $(aws sts get-caller-identity --query Arn --output text)"
echo "Syncing $SRC/*.html → s3://$BUCKET/ (region $AWS_DEFAULT_REGION)"

aws s3 sync "$SRC/" "s3://$BUCKET/" \
  --exclude "*" --include "*.html" \
  --content-type "text/html; charset=utf-8" \
  --no-progress

echo "Deployed → http://$BUCKET.s3-website-$AWS_DEFAULT_REGION.amazonaws.com/"

# --- One-time bucket bootstrap (run once) ---
# aws s3api create-bucket --bucket "$BUCKET" --region "$AWS_DEFAULT_REGION" \
#   --create-bucket-configuration LocationConstraint="$AWS_DEFAULT_REGION"
#   # (omit --create-bucket-configuration when the region is us-east-1)
# aws s3api put-public-access-block --bucket "$BUCKET" \
#   --public-access-block-configuration BlockPublicAcls=false,IgnorePublicAcls=false,BlockPublicPolicy=false,RestrictPublicBuckets=false
# aws s3api put-bucket-website --bucket "$BUCKET" \
#   --website-configuration '{"IndexDocument":{"Suffix":"index.html"},"ErrorDocument":{"Key":"index.html"}}'
# aws s3api put-bucket-policy --bucket "$BUCKET" --policy '{"Version":"2012-10-17","Statement":[{"Sid":"PublicReadGetObject","Effect":"Allow","Principal":"*","Action":"s3:GetObject","Resource":"arn:aws:s3:::'"$BUCKET"'/*"}]}'
