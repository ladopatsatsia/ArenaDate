import { uploadPhoto, type Photo } from '../src/profile/api';
const uploading: Photo = { id: 'photo-id', state: 'uploading', position: 0, width: 0, height: 0 };
const pending: Photo = { ...uploading, state: 'pending', width: 600, height: 400 };
test('lost finalize response retries the same slot and does not publish fake success', async () => {
  const api = { begin: jest.fn().mockResolvedValueOnce(uploading).mockResolvedValueOnce(pending),
    finalize: jest.fn().mockRejectedValueOnce(new Error('response_lost')) };
  const bytes = new Blob(['image']);
  await expect(uploadPhoto(api, 'same-request', bytes)).rejects.toThrow('response_lost');
  expect(await uploadPhoto(api, 'same-request', bytes)).toEqual(pending);
  expect(api.begin.mock.calls).toEqual([['same-request'], ['same-request']]); expect(api.finalize).toHaveBeenCalledTimes(1);
});
test('rejected begin never sends image bytes', async () => {
  const api = { begin: jest.fn().mockRejectedValue(new Error('photo_limit')), finalize: jest.fn() };
  await expect(uploadPhoto(api, 'request', new Blob())).rejects.toThrow('photo_limit'); expect(api.finalize).not.toHaveBeenCalled();
});
