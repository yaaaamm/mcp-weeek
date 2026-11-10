export type BoardBinding = {
    workspaceId: number;
    projectId: number;
    boardId: number;
    boardUrl: string;
};
export declare function parseBoardUrl(value: string): BoardBinding;
