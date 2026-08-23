export type LogoutFetch = (
  input: string,
  init: { credentials: "same-origin"; method: "POST" },
) => Promise<unknown>;

export async function performLogout(
  fetcher: LogoutFetch,
  navigate: (path: string) => void,
) {
  try {
    await fetcher("/api/users/logout", {
      method: "POST",
      credentials: "same-origin",
    });
  } finally {
    navigate("/user/login");
  }
}
