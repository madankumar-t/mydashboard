// Core types for AWS Inventory Dashboard

export interface AWSResource {
  id: string;
  name?: string;
  region: string;
  accountId: string;
  tags?: Record<string, string>;
  [key: string]: any;
}

export interface EC2Instance extends AWSResource {
  instance_id: string;
  name: string;
  state: 'running' | 'stopped' | 'pending' | 'stopping' | 'terminated' | 'shutting-down';
  instance_type: string;
  private_ip?: string;
  public_ip?: string;
  security_groups: string[];
  vpc_id?: string;
  subnet_id?: string;
  launch_time?: string;
}

export interface S3Bucket extends AWSResource {
  bucket_name: string;
  region: string;
  versioning: string;
  encryption: string;
  public: boolean;
  creation_date?: string;
}

export interface RDSInstance extends AWSResource {
  db_identifier: string;
  engine: string;
  engine_version: string;
  status: string;
  instance_class: string;
  endpoint?: string;
  encrypted?: boolean;
}

export interface DynamoDBTable extends AWSResource {
  table_name: string;
  status: string;
  billing_mode: string;
  item_count: number;
  region: string;
}

export interface IAMRole extends AWSResource {
  role_name: string;
  arn: string;
  created: string;
  assume_role_policy?: string;
}

export interface VPC extends AWSResource {
  vpc_id: string;
  cidr_block: string;
  state: string;
  is_default: boolean;
  subnets?: string[];
}

export interface EKSCluster extends AWSResource {
  cluster_name: string;
  status: string;
  version: string;
  endpoint?: string;
  node_groups?: string[];
}

export interface ECSCluster extends AWSResource {
  cluster_name: string;
  status: string;
  active_services?: number;
  running_tasks?: number;
}

export type ServiceType = 
  | 'ec2' 
  | 's3' 
  | 'rds' 
  | 'dynamodb' 
  | 'iam' 
  | 'vpc' 
  | 'eks' 
  | 'ecs'
  | 'lambda'      // Future
  | 'elb'         // Future
  | 'cloudfront'  // Future
  | 'route53'     // Future
  | 'sqs'         // Future
  | 'sns';        // Future

export interface InventoryResponse<T = AWSResource> {
  service: ServiceType;
  total: number;
  page: number;
  size: number;
  items: T[];
  accounts?: string[];
  regions?: string[];
}

export interface User {
  username: string;
  email?: string;
  groups: string[];
}

export interface Account {
  accountId: string;
  accountName: string;
  roleArn: string;
}

export interface Region {
  code: string;
  name: string;
}

