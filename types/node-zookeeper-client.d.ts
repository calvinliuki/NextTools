declare module 'node-zookeeper-client' {
  namespace zookeeper {
    interface Client {
      connect(): void;
      close(): void;
      getState(): any;
      create(path: string, data: Buffer | null, acls: any, mode: any, callback: (error: Error | null, path: string) => void): void;
      exists(path: string, watcher: any, callback: (error: Error | null, stat: any) => void): void;
      getData(path: string, watcher: any, callback: (error: Error | null, data: Buffer, stat: any) => void): void;
      setData(path: string, data: Buffer | null, version: number, callback: (error: Error | null, stat: any) => void): void;
      getChildren(path: string, watcher: any, callback: (error: Error | null, children: string[], stat: any) => void): void;
      remove(path: string, version: number, callback: (error: Error | null) => void): void;
      on(event: string, callback: (...args: any[]) => void): void;
      once(event: string, callback: (...args: any[]) => void): void;
      removeListener(event: string, callback: (...args: any[]) => void): void;
    }

    interface CreateMode {
      PERSISTENT: number;
      PERSISTENT_SEQUENTIAL: number;
      EPHEMERAL: number;
      EPHEMERAL_SEQUENTIAL: number;
    }

    interface ACL {
      Ids: {
        OPEN_ACL_UNSAFE: any;
        CREATOR_ALL_ACL: any;
        READ_ACL_UNSAFE: any;
      };
    }

    const CreateMode: CreateMode;
    const ACL: ACL;
    
    function createClient(connectionString: string, options?: any): Client;
  }
  
  export = zookeeper;
}
