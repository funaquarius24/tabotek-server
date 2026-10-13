export interface SerializedEditor {
  userId: string;
  name: string;
  editedAt: string;
}

export function serializeEditors(editors: any[] | undefined): SerializedEditor[] | undefined {
  if (!Array.isArray(editors) || editors.length === 0) return undefined;
  return editors.map((e) => ({
    userId: e.userId?.toString?.(),
    name: e.name,
    editedAt: e.editedAt?.toISOString?.() ?? e.editedAt,
  }));
}
