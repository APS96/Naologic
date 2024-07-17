import { CronExpression } from '@nestjs/schedule';

export const determinCrontExpression = (): CronExpression => {
  const nodeEnv = process.env.NODE_ENV;
  console.log('nodeEnv', nodeEnv);
  if (nodeEnv?.includes('dev')) {
    return CronExpression.EVERY_30_SECONDS;
  }
  if (nodeEnv?.includes('prod')) {
    return CronExpression.EVERY_DAY_AT_6AM;
  }
  return CronExpression.EVERY_30_SECONDS;
};
