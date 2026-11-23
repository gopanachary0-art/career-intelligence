const KEY = "fitcraft_workspace_id";

export function getOrCreateWorkspaceId(): string {
  if (typeof window === "undefined") return "";
  let id = localStorage.getItem(KEY);
  if (!id || !/^[0-9a-f-]{36}$/i.test(id)) {
    id = crypto.randomUUID();
    localStorage.setItem(KEY, id);
  }
  return id;
}
