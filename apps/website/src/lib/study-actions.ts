export type ArchiveAction = "archive" | "restore";

export type StudyItemBatchAction = ArchiveAction | "delete";

export type StudyItemAction = StudyItemBatchAction | "duplicate" | "move";

export type StudyCollectionAction = StudyItemBatchAction | "edit";
