// Bundler entry — registers the Remotion root so @remotion/bundler can
// discover every composition. Imported by registerRoot(); never executed
// by the server process itself.
import { registerRoot } from 'remotion'
import { RemotionRoot } from './Root'
registerRoot(RemotionRoot)
