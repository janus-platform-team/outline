import { IsOptional, IsUrl, MaxLength } from "class-validator";
import { Environment } from "@server/env";
import environment from "@server/utils/environment";
import { CannotUseWithout } from "@server/utils/validators";

class AwsSamlPluginEnvironment extends Environment {
  /**
   * The AWS IAM Identity Center single sign-on endpoint (IdP SSO URL) taken
   * from the Identity Center application's SAML metadata. Setting this together
   * with `AWS_SAML_CERT` enables authentication with AWS Identity Center.
   */
  @IsOptional()
  @IsUrl({ require_tld: false, allow_underscores: true })
  @CannotUseWithout("AWS_SAML_CERT")
  public AWS_SAML_SSO_ENDPOINT = this.toOptionalString(
    environment.AWS_SAML_SSO_ENDPOINT
  );

  /**
   * The identity provider X.509 public certificate used to validate SAML
   * assertions. May be provided as a single line without the
   * `-----BEGIN CERTIFICATE-----` header/footer, matching the convention used
   * by Outline's other SAML integrations.
   */
  @IsOptional()
  @CannotUseWithout("AWS_SAML_SSO_ENDPOINT")
  public AWS_SAML_CERT = this.toOptionalString(environment.AWS_SAML_CERT);

  /**
   * The service provider entity ID (SAML audience) that Outline presents to the
   * identity provider. Defaults to the installation URL (`URL`) when unset.
   */
  @IsOptional()
  public AWS_SAML_ENTITY_ID = this.toOptionalString(
    environment.AWS_SAML_ENTITY_ID
  );

  /**
   * The display name shown on the sign-in button and elsewhere in the UI. The
   * default value is "AWS IAM Identity Center".
   */
  @IsOptional()
  @MaxLength(50)
  public AWS_SAML_DISPLAY_NAME = this.toOptionalString(
    environment.AWS_SAML_DISPLAY_NAME
  );
}

export default new AwsSamlPluginEnvironment();
