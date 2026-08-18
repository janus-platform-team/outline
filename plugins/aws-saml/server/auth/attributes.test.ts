import type { Profile } from "@node-saml/passport-saml";
import { formatCert, getEmail, getName, readAttribute } from "./attributes";

/**
 * Builds a minimal SAML Profile for tests, allowing arbitrary attributes to be
 * supplied alongside the required NameID fields.
 */
function buildProfile(attributes: Record<string, unknown> = {}): Profile {
  return {
    issuer: "https://portal.sso.us-east-1.amazonaws.com/saml/assertion/EXAMPLE",
    nameID: "user@example.com",
    nameIDFormat: "urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress",
    ...attributes,
  } as unknown as Profile;
}

describe("readAttribute", () => {
  it("returns the first matching key in priority order", () => {
    const profile = buildProfile({ mail: "second@example.com" });
    expect(readAttribute(profile, ["email", "mail"])).toEqual(
      "second@example.com"
    );
  });

  it("flattens single-element arrays emitted by some providers", () => {
    const profile = buildProfile({ email: ["array@example.com"] });
    expect(readAttribute(profile, ["email"])).toEqual("array@example.com");
  });

  it("trims surrounding whitespace", () => {
    const profile = buildProfile({ email: "  spaced@example.com  " });
    expect(readAttribute(profile, ["email"])).toEqual("spaced@example.com");
  });

  it("skips empty values and returns undefined when nothing matches", () => {
    const profile = buildProfile({ email: "   " });
    expect(readAttribute(profile, ["email", "mail"])).toBeUndefined();
  });
});

describe("getEmail", () => {
  it("prefers the email attribute", () => {
    const profile = buildProfile({ email: "person@example.com" });
    expect(getEmail(profile)).toEqual("person@example.com");
  });

  it("resolves the standard SAML email claim URI", () => {
    const profile = buildProfile({
      "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress":
        "claim@example.com",
    });
    expect(getEmail(profile)).toEqual("claim@example.com");
  });

  it("falls back to the NameID when it is an email address", () => {
    const profile = buildProfile({ nameID: "nameid@example.com" });
    expect(getEmail(profile)).toEqual("nameid@example.com");
  });

  it("returns undefined when no email is present and NameID is opaque", () => {
    const profile = buildProfile({ nameID: "opaque-identifier" });
    expect(getEmail(profile)).toBeUndefined();
  });
});

describe("getName", () => {
  it("uses a full name attribute when present", () => {
    const profile = buildProfile({ name: "Ada Lovelace" });
    expect(getName(profile)).toEqual("Ada Lovelace");
  });

  it("composes first and last name attributes", () => {
    const profile = buildProfile({
      firstName: "Ada",
      lastName: "Lovelace",
    });
    expect(getName(profile)).toEqual("Ada Lovelace");
  });

  it("composes from a single name part when the other is absent", () => {
    const profile = buildProfile({ givenName: "Ada" });
    expect(getName(profile)).toEqual("Ada");
  });

  it("returns undefined when no name attributes are present", () => {
    const profile = buildProfile();
    expect(getName(profile)).toBeUndefined();
  });
});

describe("formatCert", () => {
  const body =
    "MIIBID09vZXhhbXBsZWNlcnRpZmljYXRlYm9keXRoYXRpc2xvbmdlbm91Z2h0b3dyYXBhY3Jvc3NtdWx0aXBsZWxpbmVz";

  it("wraps a single-line certificate body in PEM headers", () => {
    const result = formatCert(body);
    expect(result.startsWith("-----BEGIN CERTIFICATE-----\n")).toBe(true);
    expect(result.endsWith("\n-----END CERTIFICATE-----")).toBe(true);
    expect(result).toContain(body.slice(0, 64));
  });

  it("wraps the base64 body at 64 characters per line", () => {
    const lines = formatCert(body).split("\n").slice(1, -1);
    expect(lines.every((line) => line.length <= 64)).toBe(true);
    expect(lines.join("")).toEqual(body);
  });

  it("is idempotent for input that already contains PEM headers", () => {
    const pem = formatCert(body);
    expect(formatCert(pem)).toEqual(pem);
  });

  it("strips interior whitespace and newlines", () => {
    const spaced = `${body.slice(0, 20)}\n  ${body.slice(20)}`;
    expect(formatCert(spaced)).toEqual(formatCert(body));
  });
});
