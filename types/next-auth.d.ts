import "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id?: string;
      tenantId?: string | null;
      name?: string | null;
      email?: string | null;
      image?: string | null;
      role?: string;
      permissions?: string[];
    };
  }

  interface User {
    tenantId?: string | null;
    role?: string;
    permissions?: string[];
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id?: string;
    tenantId?: string | null;
    role?: string;
    permissions?: string[];
  }
}
