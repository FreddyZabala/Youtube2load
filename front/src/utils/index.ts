export const downloadFile = (newBlob: Blob, extension: string,fileName:string) => {
  const blobUrl = window.URL.createObjectURL(newBlob);

  const link = document.createElement('a');
  link.href = blobUrl;
  link.setAttribute('download', `.${fileName}.${extension}`);
  document.body.appendChild(link);
  link.click();
  link?.parentNode?.removeChild(link);
  window.URL.revokeObjectURL(blobUrl);
};
