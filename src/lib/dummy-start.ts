// Dummy implementation of @tanstack/react-start for pure client/APK builds
export function createServerFn(_options?: any) {
  return {
    validator: (_validatorFn?: any) => ({
      handler: (handlerFn: any) => async (args: any) => {
        return handlerFn(args)
      }
    }),
    handler: (handlerFn: any) => async (args: any) => {
      return handlerFn(args)
    }
  }
}
