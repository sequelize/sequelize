export interface Query {
    uuid: string,
    statistics: {
        duration?: number,
        sql: string,
        parameters?: string,
        labels: {[key: string]: any}
    }
}