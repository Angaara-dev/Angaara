import { MemberPowerTag } from '../../types/matrix/room';

const DEFAULT_TAG: MemberPowerTag = {
  name: 'Founder',
  color: '#9b5cff',
};

export const useRoomCreatorsTag = (): MemberPowerTag => DEFAULT_TAG;
