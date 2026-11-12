/**
 * share.js
 * 1200x1200の結果画像を生成し、iOS共有シートへ渡す。
 */
(function (global) {
  "use strict";

  const SIZE = 1200;
  const COLORS = {
    bg: "#FFF9F1",
    card: "#FFFFFF",
    ink: "#24201C",
    sub: "#615B54",
    vermilion: "#B53A2D",
    goldBg: "#F3DFAC",
    goldInk: "#4A3500",
    line: "#E7DCCF"
  };

  function canvasBase() {
    const canvas = document.createElement("canvas");
    canvas.width = SIZE;
    canvas.height = SIZE;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = COLORS.bg;
    ctx.fillRect(0, 0, SIZE, SIZE);
    ctx.save();
    ctx.strokeStyle = "rgba(181,58,45,0.055)";
    ctx.lineWidth = 2;
    for (let x = -SIZE; x < SIZE * 2; x += 72) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x + SIZE, SIZE);
      ctx.stroke();
    }
    ctx.restore();
    return { canvas, ctx };
  }

  function roundRect(ctx, x, y, width, height, radius, fill, stroke) {
    ctx.beginPath();
    ctx.roundRect(x, y, width, height, radius);
    if (fill) {
      ctx.fillStyle = fill;
      ctx.fill();
    }
    if (stroke) {
      ctx.strokeStyle = stroke;
      ctx.lineWidth = 2;
      ctx.stroke();
    }
  }

  function font(size, weight = 700) {
    return `${weight} ${size}px -apple-system, BlinkMacSystemFont, "Hiragino Sans", "Yu Gothic", sans-serif`;
  }

  function fitText(ctx, text, maxWidth, startSize, minSize, weight = 700) {
    let size = startSize;
    while (size > minSize) {
      ctx.font = font(size, weight);
      if (ctx.measureText(text).width <= maxWidth) break;
      size -= 2;
    }
    return size;
  }

  function centerText(ctx, text, y, size, color, weight = 700) {
    ctx.font = font(size, weight);
    ctx.fillStyle = color;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(text, SIZE / 2, y);
  }

  function drawBrand(ctx, subtitle) {
    centerText(ctx, "なまえガチャ", 92, 42, COLORS.vermilion, 800);
    centerText(ctx, subtitle, 148, 28, COLORS.sub, 600);
  }

  function drawFooter(ctx) {
    ctx.strokeStyle = COLORS.line;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(90, 1080);
    ctx.lineTo(1110, 1080);
    ctx.stroke();
    centerText(ctx, "あなたも名前を引いてみよう", 1122, 28, COLORS.ink, 700);
    centerText(ctx, "なまえガチャ － ランダム姓名メーカー", 1165, 22, COLORS.sub, 500);
  }

  function drawSingle(entry) {
    const { canvas, ctx } = canvasBase();
    drawBrand(ctx, "今回のガチャ結果");
    roundRect(ctx, 110, 220, 980, 760, 40, COLORS.card, COLORS.line);
    centerText(ctx, "今回の名前", 322, 30, COLORS.vermilion, 700);
    const name = NamaeGachaEnglish.name(entry);
    const nameSize = fitText(ctx, name, 840, 104, 54, 800);
    centerText(ctx, name, 545, nameSize, COLORS.ink, 800);
    const reading = NamaeGachaEnglish.reading(entry);
    const readingSize = fitText(ctx, reading, 800, 38, 24, 500);
    centerText(ctx, reading, 660, readingSize, COLORS.sub, 500);
    roundRect(ctx, 330, 770, 540, 92, 46, COLORS.goldBg);
    centerText(ctx, "お気に入りの名前に出会えた？", 816, 25, COLORS.goldInk, 700);
    drawFooter(ctx);
    return canvas;
  }

  function drawTen(entries) {
    const { canvas, ctx } = canvasBase();
    drawBrand(ctx, "10連ガチャ結果");
    const startX = 76;
    const startY = 202;
    const cardWidth = 506;
    const cardHeight = 154;
    const gapX = 36;
    const gapY = 18;
    entries.slice(0, 10).forEach((entry, index) => {
      const column = index % 2;
      const row = Math.floor(index / 2);
      const x = startX + column * (cardWidth + gapX);
      const y = startY + row * (cardHeight + gapY);
      roundRect(ctx, x, y, cardWidth, cardHeight, 24, COLORS.card, COLORS.line);
      ctx.fillStyle = COLORS.vermilion;
      ctx.font = font(25, 800);
      ctx.textAlign = "left";
      ctx.textBaseline = "middle";
      ctx.fillText(String(index + 1).padStart(2, "0"), x + 24, y + 38);
      const name = NamaeGachaEnglish.name(entry);
      const nameSize = fitText(ctx, name, cardWidth - 110, 38, 23, 800);
      ctx.font = font(nameSize, 800);
      ctx.fillStyle = COLORS.ink;
      ctx.textAlign = "center";
      ctx.fillText(name, x + cardWidth / 2 + 18, y + 62);
      const reading = NamaeGachaEnglish.reading(entry);
      const readingSize = fitText(ctx, reading, cardWidth - 48, 22, 16, 500);
      ctx.font = font(readingSize, 500);
      ctx.fillStyle = COLORS.sub;
      ctx.fillText(reading, x + cardWidth / 2, y + 112);
    });
    drawFooter(ctx);
    return canvas;
  }

  function drawChallenge(result) {
    const { canvas, ctx } = canvasBase();
    drawBrand(ctx, "自分の名前は何回目？");
    roundRect(ctx, 110, 215, 980, 770, 40, COLORS.card, COLORS.line);
    const fullName = `${result.surname} ${result.givenName}さんは`;
    const nameSize = fitText(ctx, fullName, 820, 60, 36, 800);
    centerText(ctx, fullName, 350, nameSize, COLORS.ink, 800);
    centerText(ctx, "今回のチャレンジで", 445, 30, COLORS.sub, 600);
    const countText = result.capped
      ? "1兆回以上"
      : `${Number(result.count).toLocaleString("ja-JP")}回目`;
    const countSize = fitText(ctx, countText, 850, 112, 58, 900);
    centerText(ctx, countText, 590, countSize, COLORS.vermilion, 900);
    roundRect(ctx, 260, 730, 680, 105, 30, COLORS.goldBg);
    const bestText = result.bestCapped
      ? "ベスト記録　1兆回以上"
      : `ベスト記録　${Number(result.bestCount).toLocaleString("ja-JP")}回目`;
    const bestSize = fitText(ctx, bestText, 610, 34, 24, 800);
    centerText(ctx, bestText, 782, bestSize, COLORS.goldInk, 800);
    centerText(ctx, "結果はチャレンジするたびに変わります", 910, 23, COLORS.sub, 500);
    drawFooter(ctx);
    return canvas;
  }

  function canvasToBlob(canvas) {
    return new Promise((resolve, reject) => {
      canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error("IMAGE_CREATE_FAILED")), "image/png");
    });
  }

  function blobToBase64(blob) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(String(reader.result).split(",")[1]);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }

  function isCancelError(error) {
    const message = String(error && (error.message || error));
    return /cancel|canceled|cancelled|dismiss/i.test(message);
  }

  async function shareCanvas(canvas, options) {
    const blob = await canvasToBlob(canvas);
    const filename = `namaegacha-${Date.now()}.png`;
    const plugins = global.Capacitor && global.Capacitor.Plugins;
    const Filesystem = plugins && plugins.Filesystem;
    const Share = plugins && plugins.Share;

    if (Filesystem && Share) {
      let path = null;
      try {
        const data = await blobToBase64(blob);
        path = `namaegacha/${filename}`;
        const written = await Filesystem.writeFile({
          path,
          data,
          directory: "CACHE",
          recursive: true
        });
        await Share.share({
          title: options.title,
          text: options.text,
          url: written.uri,
          dialogTitle: "結果を共有"
        });
        return { success: true };
      } catch (error) {
        if (isCancelError(error)) return { cancelled: true };
        throw error;
      } finally {
        if (path) {
          try {
            await Filesystem.deleteFile({ path, directory: "CACHE" });
          } catch (_) {}
        }
      }
    }

    const file = new File([blob], filename, { type: "image/png" });
    if (navigator.share && (!navigator.canShare || navigator.canShare({ files: [file] }))) {
      try {
        await navigator.share({
          title: options.title,
          text: options.text,
          files: [file]
        });
        return { success: true };
      } catch (error) {
        if (isCancelError(error)) return { cancelled: true };
        throw error;
      }
    }

    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    return { success: true, downloaded: true };
  }

  global.NamaeGachaShare = {
    async single(entry, appStoreUrl) {
      return shareCanvas(drawSingle(entry), {
        title: "なまえガチャ",
        text: `なまえガチャで「${NamaeGachaEnglish.name(entry)}」が出ました！\n#なまえガチャ${appStoreUrl ? `\n${appStoreUrl}` : ""}`
      });
    },
    async ten(entries, appStoreUrl) {
      return shareCanvas(drawTen(entries), {
        title: "なまえガチャ 10連結果",
        text: `なまえガチャで10連してみました！\n#なまえガチャ${appStoreUrl ? `\n${appStoreUrl}` : ""}`
      });
    },
    async challenge(result, appStoreUrl) {
      const countText = result.capped ? "1兆回以上" : `${Number(result.count).toLocaleString("ja-JP")}回目`;
      return shareCanvas(drawChallenge(result), {
        title: "自分の名前は何回目？",
        text: `「${result.surname} ${result.givenName}」は今回${countText}に登場しました！\n#なまえガチャ${appStoreUrl ? `\n${appStoreUrl}` : ""}`
      });
    }
  };
})(window);

