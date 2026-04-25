export function imageDateStamp() {
  const now = new Date();
  const pad = (value) => String(value).padStart(2, "0");
  return `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}`;
}

export function downloadCanvasAsPng(canvas, filename) {
  return new Promise((resolve, reject) => {
    const downloadBlob = (blob) => {
      if (!blob) {
        reject(new Error("图片生成失败。"));
        return;
      }
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      resolve();
    };

    if (canvas.toBlob) {
      canvas.toBlob(downloadBlob, "image/png");
      return;
    }

    try {
      const link = document.createElement("a");
      link.href = canvas.toDataURL("image/png");
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      resolve();
    } catch (error) {
      reject(error instanceof Error ? error : new Error("图片下载失败。"));
    }
  });
}

export function isWeChatBrowser() {
  return /MicroMessenger/i.test(window.navigator.userAgent || "");
}
