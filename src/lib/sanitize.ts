export const sanitizeUser = <T extends Record<string, any> | null | undefined>(
  user: T,
) => {
  if (!user) return user;
  const { password, two_factor_secret, ...safe } = user as Record<string, any>;
  return safe as Omit<NonNullable<T>, "password" | "two_factor_secret">;
};
