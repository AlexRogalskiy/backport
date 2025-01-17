import findUp from 'find-up';
import * as fs from '../../services/fs-promisified';
import { getProjectConfig } from './projectConfig';

describe('getProjectConfig', () => {
  afterEach(() => jest.clearAllMocks());

  describe('deprecations', () => {
    describe('when specifying deprecated `branches`', () => {
      it('is returned as `targetBranchChoices`', async () => {
        jest.spyOn(fs, 'readFile').mockResolvedValueOnce(
          JSON.stringify({
            repoName: 'kibana',
            repoOwner: 'elastic',
            branches: ['6.x'],
          })
        );

        const projectConfig = await getProjectConfig();
        expect(projectConfig?.targetBranchChoices).toEqual(['6.x']);
      });
    });

    describe('when specifying deprecated `labels`', () => {
      it('is returned as `targetPRLabels`', async () => {
        jest.spyOn(fs, 'readFile').mockResolvedValueOnce(
          JSON.stringify({
            labels: ['backport'],
          })
        );

        const projectConfig = await getProjectConfig();
        expect(projectConfig?.targetPRLabels).toEqual(['backport']);
      });
    });

    describe('when specifying deprecated `upstream`', () => {
      it('is split into `repoOwner` and `repoName`', async () => {
        jest.spyOn(fs, 'readFile').mockResolvedValueOnce(
          JSON.stringify({
            upstream: 'elastic/kibana',
          })
        );

        const projectConfig = await getProjectConfig();
        expect(projectConfig?.repoOwner).toEqual('elastic');
        expect(projectConfig?.repoName).toEqual('kibana');
      });
    });

    describe('when projectConfig is valid', () => {
      let projectConfig: Awaited<ReturnType<typeof getProjectConfig>>;
      beforeEach(async () => {
        jest.spyOn(fs, 'readFile').mockResolvedValueOnce(
          JSON.stringify({
            repoName: 'kibana',
            repoOwner: 'elastic',
            targetBranchChoices: ['6.x'],
            targetPRLabels: ['backport'],
          })
        );

        projectConfig = await getProjectConfig();
      });

      it('should call findUp', () => {
        expect(findUp).toHaveBeenCalledWith('.backportrc.json');
      });

      it('should return config', () => {
        expect(projectConfig).toEqual({
          repoName: 'kibana',
          repoOwner: 'elastic',
          targetBranchChoices: ['6.x'],
          targetPRLabels: ['backport'],
        });
      });
    });
  });

  describe('when projectConfig is empty', () => {
    it('should return empty config', async () => {
      jest.spyOn(fs, 'readFile').mockResolvedValueOnce('{}');
      const projectConfig = await getProjectConfig();
      expect(projectConfig).toEqual({});
    });
  });

  describe('when projectConfig is missing', () => {
    it('should return empty config', async () => {
      (findUp as any as jest.SpyInstance).mockReturnValueOnce(undefined);
      const projectConfig = await getProjectConfig();
      expect(projectConfig).toEqual(undefined);
    });
  });
});
