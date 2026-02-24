export interface CLIArgs {
  model: string;
  model_alias?: string;
  dtype: string;
  n_ctx: number;
  n_batch: number;
  n_ubatch: number;
  n_threads: number;
  n_threads_batch: number;
  rope_scaling_type: string;
  rope_freq_base: number;
  rope_freq_scale: number;
  use_mmap: boolean;
  use_mlock: boolean;
  cache: boolean;
  cache_type: string;
  cache_size: number;
  host: string;
  port: number;
  api_key?: string;
  interrupt_requests: boolean;
  disable_ping_events: boolean;
  root_path: string;
  verbose: boolean;
  hf_tokenizer_config_path?: string;
  hf_pretrained_model_name_or_path?: string;
  lora_path?: string;
  lora_base?: string;
}

export class Config {
  model: string;
  modelAlias: string;
  dtype: string;
  nCtx: number;
  nBatch: number;
  nUbatch: number;
  nThreads: number;
  nThreadsBatch: number;
  ropeScalingType: string;
  ropeFreqBase: number;
  ropeFreqScale: number;
  useMmap: boolean;
  useMlock: boolean;
  cache: boolean;
  cacheType: string;
  cacheSize: number;
  host: string;
  port: number;
  apiKey?: string;
  interruptRequests: boolean;
  disablePingEvents: boolean;
  rootPath: string;
  verbose: boolean;
  hfTokenizerConfigPath?: string;
  hfPretrainedModelNameOrPath?: string;
  loraPath?: string;
  loraBase?: string;

  constructor(args: CLIArgs) {
    this.model = args.model;
    this.modelAlias = args.model_alias || this.deriveModelAlias(args.model);
    this.dtype = args.dtype;
    this.nCtx = args.n_ctx;
    this.nBatch = args.n_batch;
    this.nUbatch = args.n_ubatch;
    this.nThreads = args.n_threads;
    this.nThreadsBatch = args.n_threads_batch;
    this.ropeScalingType = args.rope_scaling_type;
    this.ropeFreqBase = args.rope_freq_base;
    this.ropeFreqScale = args.rope_freq_scale;
    this.useMmap = args.use_mmap;
    this.useMlock = args.use_mlock;
    this.cache = args.cache;
    this.cacheType = args.cache_type;
    this.cacheSize = args.cache_size;
    this.host = args.host;
    this.port = args.port;
    this.apiKey = args.api_key;
    this.interruptRequests = args.interrupt_requests;
    this.disablePingEvents = args.disable_ping_events;
    this.rootPath = args.root_path;
    this.verbose = args.verbose;
    this.hfTokenizerConfigPath = args.hf_tokenizer_config_path;
    this.hfPretrainedModelNameOrPath = args.hf_pretrained_model_name_or_path;
    this.loraPath = args.lora_path;
    this.loraBase = args.lora_base;
  }

  private deriveModelAlias(modelId: string): string {
    const parts = modelId.split('/');
    const lastPart = parts[parts.length - 1];
    return (lastPart ?? modelId).toLowerCase().replace(/[^a-z0-9-]/g, '-');
  }
}

function parseArgs(): CLIArgs {
  const args = process.argv.slice(2);
  const parsed: Partial<CLIArgs> = {};

  for (let i = 0; i < args.length; i += 2) {
    const key = (args[i] ?? '').replace(/^--/, '');
    const value = args[i + 1] ?? '';

    switch (key) {
      case 'model':
        parsed.model = value;
        break;
      case 'model_alias':
        parsed.model_alias = value;
        break;
      case 'dtype':
        parsed.dtype = value;
        break;
      case 'n_ctx':
        parsed.n_ctx = parseInt(value, 10);
        break;
      case 'n_batch':
        parsed.n_batch = parseInt(value, 10);
        break;
      case 'n_ubatch':
        parsed.n_ubatch = parseInt(value, 10);
        break;
      case 'n_threads':
        parsed.n_threads = parseInt(value, 10);
        break;
      case 'n_threads_batch':
        parsed.n_threads_batch = parseInt(value, 10);
        break;
      case 'rope_scaling_type':
        parsed.rope_scaling_type = value;
        break;
      case 'rope_freq_base':
        parsed.rope_freq_base = parseFloat(value);
        break;
      case 'rope_freq_scale':
        parsed.rope_freq_scale = parseFloat(value);
        break;
      case 'use_mmap':
        parsed.use_mmap = value === 'true';
        break;
      case 'use_mlock':
        parsed.use_mlock = value === 'true';
        break;
      case 'cache':
        parsed.cache = value === 'true';
        break;
      case 'cache_type':
        parsed.cache_type = value;
        break;
      case 'cache_size':
        parsed.cache_size = parseInt(value, 10);
        break;
      case 'host':
        parsed.host = value;
        break;
      case 'port':
        parsed.port = parseInt(value, 10);
        break;
      case 'api_key':
        parsed.api_key = value;
        break;
      case 'interrupt_requests':
        parsed.interrupt_requests = value === 'true';
        break;
      case 'disable_ping_events':
        parsed.disable_ping_events = value === 'true';
        break;
      case 'root_path':
        parsed.root_path = value;
        break;
      case 'verbose':
        parsed.verbose = value === 'true';
        break;
      case 'hf_tokenizer_config_path':
        parsed.hf_tokenizer_config_path = value;
        break;
      case 'hf_pretrained_model_name_or_path':
        parsed.hf_pretrained_model_name_or_path = value;
        break;
      case 'lora_path':
        parsed.lora_path = value;
        break;
      case 'lora_base':
        parsed.lora_base = value;
        break;
    }
  }

  const defaults: CLIArgs = {
    model: '',
    model_alias: undefined,
    dtype: 'q4',
    n_ctx: 2048,
    n_batch: 512,
    n_ubatch: 512,
    n_threads: 4,
    n_threads_batch: 4,
    rope_scaling_type: 'linear',
    rope_freq_base: 0.0,
    rope_freq_scale: 0.0,
    use_mmap: true,
    use_mlock: false,
    cache: false,
    cache_type: 'ram',
    cache_size: 2 * 1024 * 1024 * 1024,
    host: 'localhost',
    port: 8080,
    api_key: undefined,
    interrupt_requests: true,
    disable_ping_events: false,
    root_path: '',
    verbose: true,
    hf_tokenizer_config_path: undefined,
    hf_pretrained_model_name_or_path: undefined,
    lora_path: undefined,
    lora_base: undefined,
  };

  return {
    ...defaults,
    model: parsed.model ?? defaults.model,
    model_alias: parsed.model_alias,
    dtype: parsed.dtype ?? defaults.dtype,
    n_ctx: parsed.n_ctx ?? defaults.n_ctx,
    n_batch: parsed.n_batch ?? defaults.n_batch,
    n_ubatch: parsed.n_ubatch ?? defaults.n_ubatch,
    n_threads: parsed.n_threads ?? defaults.n_threads,
    n_threads_batch: parsed.n_threads_batch ?? defaults.n_threads_batch,
    rope_scaling_type: parsed.rope_scaling_type ?? defaults.rope_scaling_type,
    rope_freq_base: parsed.rope_freq_base ?? defaults.rope_freq_base,
    rope_freq_scale: parsed.rope_freq_scale ?? defaults.rope_freq_scale,
    use_mmap: parsed.use_mmap ?? defaults.use_mmap,
    use_mlock: parsed.use_mlock ?? defaults.use_mlock,
    cache: parsed.cache ?? defaults.cache,
    cache_type: parsed.cache_type ?? defaults.cache_type,
    cache_size: parsed.cache_size ?? defaults.cache_size,
    host: parsed.host ?? defaults.host,
    port: parsed.port ?? defaults.port,
    api_key: parsed.api_key,
    interrupt_requests: parsed.interrupt_requests ?? defaults.interrupt_requests,
    disable_ping_events: parsed.disable_ping_events ?? defaults.disable_ping_events,
    root_path: parsed.root_path ?? defaults.root_path,
    verbose: parsed.verbose ?? defaults.verbose,
    hf_tokenizer_config_path: parsed.hf_tokenizer_config_path,
    hf_pretrained_model_name_or_path: parsed.hf_pretrained_model_name_or_path,
    lora_path: parsed.lora_path,
    lora_base: parsed.lora_base,
  };
}

export const config = new Config(parseArgs());
