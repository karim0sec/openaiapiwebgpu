import { getModelAlias, isModelLoaded, getModelId } from '../lib/pipeline.js';
import type { ModelList } from '../lib/types.js';

export function handleModels(): ModelList {
  const modelAlias = getModelAlias();
  
  return {
    object: 'list',
    data: [
      {
        id: modelAlias,
        object: 'model',
        owned_by: 'me',
        permissions: [],
      },
    ],
  };
}

export function getModelInfo() {
  return {
    id: getModelAlias(),
    object: 'model',
    owned_by: 'me',
    permissions: [],
    ready: isModelLoaded(),
  };
}
