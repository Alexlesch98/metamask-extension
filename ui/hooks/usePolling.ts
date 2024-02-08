import { useEffect, useRef } from 'react';

type UsePollingOptions = {
  callback?: (pollingToken: string) => (pollingToken: string) => void;
  startPollingByNetworkClientId: (
    networkClientId: string,
    options: any,
  ) => string;
  stopPollingByPollingToken: (pollingToken: string) => void;
  networkClientId: string;
  options?: any;
};

const usePolling = (usePollingOptions: UsePollingOptions) => {
  const pollTokenRef = useRef<null | string>(null);
  useEffect(() => {
    // Start polling when the component mounts
    pollTokenRef.current = usePollingOptions.startPollingByNetworkClientId(
      usePollingOptions.networkClientId,
      usePollingOptions.options,
    );
    // eslint-disable-next-line node/callback-return
    const cleanup = usePollingOptions.callback?.(pollTokenRef.current);
    // Return a cleanup function to stop polling when the component unmounts
    return () => {
      if (pollTokenRef.current) {
        usePollingOptions.stopPollingByPollingToken(pollTokenRef.current);
        cleanup?.(pollTokenRef.current);
      }
    };
  }, []);
};

export default usePolling;