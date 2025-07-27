import { useRef, useState, useEffect } from 'react';
import { FaImage, FaSave, FaUndo, FaRedo, FaPlus, FaTrash, FaItalic, FaBold, FaUnderline } from 'react-icons/fa';
import { useLocation, useNavigate } from 'react-router-dom';
import 'tailwindcss/tailwind.css';
import Canvas from './Canvas';
import Konva from 'konva';

export default function Editor() {
  const [selectedProduct, setSelectedProduct] = useState(null);
  const stageRef = useRef(null);
  const transformerRef = useRef(null);
  const [objects, setObjects] = useState([]);
  const [selectedObjectIds, setSelectedObjectIds] = useState(new Set());
  const [side, setSide] = useState('front');
  const [size, setSize] = useState(null);
  const [history, setHistory] = useState([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [rotationAngle, setRotationAngle] = useState(null);
  const [rotationAnchorPos, setRotationAnchorPos] = useState(null);
  const [imageLoading, setImageLoading] = useState(false);
  const [imageError, setImageError] = useState(null);
  const [selectionRect, setSelectionRect] = useState({ visible: false, x: 0, y: 0, width: 0, height: 0 });
  const [dragStartPos, setDragStartPos] = useState(null);
  const [draggingObjectId, setDraggingObjectId] = useState(null);
  const [cursorIndicator, setCursorIndicator] = useState({ visible: false, x: 0, y: 0, text: '' });
  const [fileInputKey, setFileInputKey] = useState(Date.now());
  const [clipboard, setClipboard] = useState([]);
  const [cursorPos, setCursorPos] = useState({ x: 0, y: 0 });
  const [draggedLayerId, setDraggedLayerId] = useState(null);
  const [activeTextSettings, setActiveTextSettings] = useState('main');
  const [guides, setGuides] = useState({ horizontal: [], vertical: [] });
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [saveSides, setSaveSides] = useState({ front: true, back: false });
  const [saveFormat, setSaveFormat] = useState('png');

  const location = useLocation();
  const navigate = useNavigate();

  const products = [
    'Визитки', 'Листовки', 'Буклеты', 'Плакаты', 'Календари',
    'Блокноты', 'Открытки', 'Пакеты', 'Одежда', 'Сувенирная продукция'
  ];

  const sizes = {
    euro55x85: { width: 156, height: 241 },
    euro85x55: { width: 241, height: 156 },
    standard50x90: { width: 141, height: 255 },
    standard90x50: { width: 255, height: 141 },
  };

  const fonts = ['Inter', 'Roboto', 'Open Sans', 'Lora', 'Poppins', 'Arial', 'Times New Roman'];

  const workspaceSize = { width: 900, height: 600 };

  const getMaximizedSize = (originalSize) => {
    const padding = 40;
    const maxWidth = workspaceSize.width - padding;
    const maxHeight = workspaceSize.height - padding;
    const aspectRatio = originalSize.width / originalSize.height;
    let newWidth = maxWidth;
    let newHeight = newWidth / aspectRatio;

    if (newHeight > maxHeight) {
      newHeight = maxHeight;
      newWidth = newHeight * aspectRatio;
    }

    return { width: Math.round(newWidth), height: Math.round(newHeight) };
  };

  const canvasBounds = size ? {
    x: (workspaceSize.width - size.width) / 2,
    y: (workspaceSize.height - size.height) / 2,
    width: size.width,
    height: size.height,
  } : { x: 0, y: 0, width: 0, height: 0 };

  const minSize = 30;
  const maxSize = size ? Math.min(size.width + 10, size.height + 10) : Math.min(workspaceSize.width + 10, workspaceSize.height + 10);
  const minFontSize = 8;
  const maxFontSize = 72;

  const getObjectStatus = (obj, node) => {
    if (!node) return 'inside';
    const box = node.getClientRect();
    const bounds = {
      x: canvasBounds.x,
      y: canvasBounds.y,
      width: canvasBounds.width,
      height: canvasBounds.height,
    };

    const isInside = (
      box.x >= bounds.x &&
      box.y >= bounds.y &&
      box.x + box.width <= bounds.x + bounds.width &&
      box.y + box.height <= bounds.y + bounds.height
    );

    const isIntersecting = (
      box.x < bounds.x + bounds.width &&
      box.x + box.width > bounds.x &&
      box.y < bounds.y + bounds.height &&
      box.y + box.height > bounds.y
    );

    if (isInside) return 'inside';
    if (isIntersecting) return 'partial';
    return 'outside';
  };

  const updateObjectStatuses = (updatedObjects) => {
    return updatedObjects.map((obj) => {
      const node = stageRef.current?.findOne(`#${obj.id}`);
      return { ...obj, status: getObjectStatus(obj, node) };
    });
  };

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const product = params.get('product');
    if (product && products.includes(product)) {
      setSelectedProduct(product);
      const newSize = product === 'Визитки' ? getMaximizedSize(sizes.standard90x50) : getMaximizedSize({ width: 595, height: 842 });
      setSize(newSize);
      setObjects([]);
      setHistory([{ objects: [], size: newSize }]);
      setHistoryIndex(0);
      setSelectedObjectIds(new Set());
      setFileInputKey(Date.now());
      setClipboard([]);
      setGuides({ horizontal: [], vertical: [] });
    }
  }, [location]);

  const handleProductSelect = (product) => {
    setSelectedProduct(product);
    navigate(`/editor?product=${encodeURIComponent(product)}`);
    const newSize = product === 'Визитки' ? getMaximizedSize(sizes.standard90x50) : getMaximizedSize({ width: 595, height: 842 });
    setSize(newSize);
    setObjects([]);
    setHistory([{ objects: [], size: newSize }]);
    setHistoryIndex(0);
    setSelectedObjectIds(new Set());
    setFileInputKey(Date.now());
    setClipboard([]);
    setActiveTextSettings('main');
    setGuides({ horizontal: [], vertical: [] });
  };

  const addToHistory = (newObjects, newSize) => {
    const newState = { objects: [...newObjects], size: { ...newSize } };
    const currentState = history[historyIndex];
    if (
      currentState &&
      JSON.stringify(currentState.objects) === JSON.stringify(newState.objects) &&
      JSON.stringify(currentState.size) === JSON.stringify(newState.size)
    ) {
      return;
    }
    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push(newState);
    setHistory(newHistory);
    setHistoryIndex(newHistory.length - 1);
  };

  const undo = () => {
    if (historyIndex > 0) {
      const prevIndex = historyIndex - 1;
      const prevState = history[prevIndex];
      setObjects([...prevState.objects]);
      setSize({ ...prevState.size });
      setHistoryIndex(prevIndex);
      setSelectedObjectIds(new Set());
      setRotationAngle(null);
      setRotationAnchorPos(null);
      setDraggingObjectId(null);
      setCursorIndicator({ visible: false, x: 0, y: 0, text: '' });
      setImageLoading(false);
      setImageError(null);
      setFileInputKey(Date.now());
      setActiveTextSettings('main');
      setGuides({ horizontal: [], vertical: [] });
      if (transformerRef.current) {
        transformerRef.current.nodes([]);
        transformerRef.current.getLayer()?.batchDraw();
      }
    }
  };

  const redo = () => {
    if (historyIndex < history.length - 1) {
      const nextIndex = historyIndex + 1;
      const nextState = history[nextIndex];
      setObjects([...nextState.objects]);
      setSize({ ...nextState.size });
      setHistoryIndex(nextIndex);
      setSelectedObjectIds(new Set());
      setRotationAngle(null);
      setRotationAnchorPos(null);
      setDraggingObjectId(null);
      setCursorIndicator({ visible: false, x: 0, y: 0, text: '' });
      setImageLoading(false);
      setImageError(null);
      setFileInputKey(Date.now());
      setActiveTextSettings('main');
      setGuides({ horizontal: [], vertical: [] });
      if (transformerRef.current) {
        transformerRef.current.nodes([]);
        transformerRef.current.getLayer()?.batchDraw();
      }
    }
  };

  const copySelectedObjects = async () => {
    const selectedObjects = objects.filter((obj) => selectedObjectIds.has(obj.id) && obj.side === side);
    const copiedObjects = selectedObjects.map((obj) => {
      const copy = JSON.parse(JSON.stringify(obj));
      if (obj.type === 'image' && obj.image) {
        copy.imageSrc = obj.image.src;
        delete copy.image;
      }
      return copy;
    });
    setClipboard(copiedObjects);

    try {
      const permissionStatus = await navigator.permissions.query({ name: 'clipboard-write' });
      if (permissionStatus.state === 'denied') {
        setImageError('Доступ к записи в буфер обмена запрещен');
        return;
      }

      if (selectedObjects.length === 1 && selectedObjects[0].type === 'text') {
        const textObj = selectedObjects[0];
        const styledText = JSON.stringify({
          text: textObj.value,
          fontSize: textObj.fontSize,
          fontFamily: textObj.fontFamily,
          fill: textObj.fill,
          fontStyle: textObj.fontStyle,
          textDecoration: textObj.textDecoration,
          align: textObj.align,
          lineHeight: textObj.lineHeight,
          letterSpacing: textObj.letterSpacing,
          stroke: textObj.stroke,
          strokeWidth: textObj.strokeWidth,
          shadowColor: textObj.shadowColor,
          shadowOffsetX: textObj.shadowOffsetX,
          shadowOffsetY: textObj.shadowOffsetY,
          shadowBlur: textObj.shadowBlur,
          shadowOpacity: textObj.shadowOpacity,
          rotation: textObj.rotation,
          width: textObj.width,
          height: textObj.height,
        });
        await navigator.clipboard.writeText(styledText);
      } else {
        const stage = stageRef.current.getStage();
        const selectedNodes = selectedObjects.map((obj) => stage.findOne(`#${obj.id}`)).filter((node) => node);
        if (selectedNodes.length === 0) return;

        const bounds = selectedNodes.reduce(
          (acc, node) => {
            const box = node.getClientRect();
            return {
              x: Math.min(acc.x, box.x),
              y: Math.min(acc.y, box.y),
              xMax: Math.max(acc.xMax, box.x + box.width),
              yMax: Math.max(acc.yMax, box.y + box.height),
            };
          },
          { x: Infinity, y: Infinity, xMax: -Infinity, yMax: -Infinity }
        );

        const width = bounds.xMax - bounds.x;
        const height = bounds.yMax - bounds.y;

        const tempLayer = new window.Konva.Layer();
        stage.add(tempLayer);
        selectedNodes.forEach((node) => {
          const clone = node.clone();
          clone.position({ x: node.x() - bounds.x, y: node.y() - bounds.y });
          tempLayer.add(clone);
        });

        const canvas = await tempLayer.toCanvas({ width, height, pixelRatio: 2 });
        tempLayer.destroy();

        canvas.toBlob(async (blob) => {
          try {
            await navigator.clipboard.write([
              new ClipboardItem({ 'image/png': blob })
            ]);
          } catch (err) {
            console.error('Clipboard write error:', err);
            setImageError('Ошибка записи в буфер обмена');
          }
        }, 'image/png');
      }
    } catch (err) {
      console.error('Clipboard permission error:', err);
      setImageError('Ошибка доступа к буферу обмена');
    }
  };

  const pasteObjects = async () => {
    try {
      const permissionStatus = await navigator.permissions.query({ name: 'clipboard-read' });
      if (permissionStatus.state === 'denied') {
        setImageError('Доступ к буферу обмена запрещен');
        return;
      }

      const clipboardItems = await navigator.clipboard.read();
      let newObjects = [];
      let handled = false;

      for (const item of clipboardItems) {
        if (item.types.includes('image/png') || item.types.includes('image/jpeg')) {
          const blob = await item.getType(item.types.find((type) => type.startsWith('image/')));
          if (['image/png', 'image/jpeg'].includes(blob.type)) {
            setImageLoading(true);
            setImageError(null);
            const reader = new FileReader();
            reader.onload = () => {
              const img = new window.Image();
              img.src = reader.result;
              img.onload = () => {
                const aspectRatio = img.width / img.height;
                let width = Math.min(size.width * 0.5, maxSize);
                let height = width / aspectRatio;
                if (height > maxSize) {
                  height = maxSize;
                  width = height * aspectRatio;
                }
                width = Math.max(minSize, width);
                height = Math.max(minSize, height);
                const newObject = {
                  id: Date.now() + Math.random(),
                  type: 'image',
                  image: img,
                  x: canvasBounds.x + canvasBounds.width / 2,
                  y: canvasBounds.y + canvasBounds.height / 2,
                  width,
                  height,
                  rotation: 0,
                  opacity: 1,
                  side,
                  zIndex: objects.length,
                  status: 'inside',
                };
                newObjects.push(newObject);
                setImageLoading(false);
                setImageError(null);
                const updatedObjects = [...objects, ...newObjects];
                setObjects(updateObjectStatuses(updatedObjects));
                setSelectedObjectIds(new Set(newObjects.map((obj) => obj.id)));
                addToHistory(updatedObjects, size);
              };
              img.onerror = () => {
                setImageError('Не удалось загрузить изображение из буфера обмена');
                setImageLoading(false);
              };
            };
            reader.onerror = () => {
              setImageError('Ошибка чтения изображения из буфера обмена');
              setImageLoading(false);
            };
            reader.readAsDataURL(blob);
            handled = true;
            break;
          }
        }
      }

      if (!handled) {
        const text = await navigator.clipboard.readText();
        if (text) {
          let textObj;
          try {
            textObj = JSON.parse(text);
            if (textObj.text && typeof textObj.text === 'string') {
              const newObject = {
                id: Date.now() + Math.random(),
                type: 'text',
                value: textObj.text,
                x: canvasBounds.x + canvasBounds.width / 2,
                y: canvasBounds.y + canvasBounds.height / 2,
                fontSize: Number(textObj.fontSize) || 20,
                fontFamily: textObj.fontFamily || 'Inter',
                fill: textObj.fill || '#0288d1',
                align: textObj.align || 'left',
                lineHeight: Number(textObj.lineHeight) || 1.2,
                letterSpacing: Number(textObj.letterSpacing) || 0,
                stroke: textObj.stroke || null,
                strokeWidth: Number(textObj.strokeWidth) || 0,
                shadowOffsetX: Number(textObj.shadowOffsetX) || 0,
                shadowOffsetY: Number(textObj.shadowOffsetY) || 0,
                shadowBlur: Number(textObj.shadowBlur) || 0,
                shadowOpacity: Number(textObj.shadowOpacity) || 0,
                shadowColor: textObj.shadowColor || '#000000',
                fontStyle: textObj.fontStyle || 'normal',
                textDecoration: textObj.textDecoration || 'none',
                side,
                zIndex: objects.length,
                width: Number(textObj.width) || Math.min(150, maxSize),
                height: Number(textObj.height) || Math.min(50, maxSize),
                rotation: Number(textObj.rotation) || 0,
                status: 'inside',
              };
              newObjects.push(newObject);
            } else {
              throw new Error('Invalid text object format');
            }
          } catch (e) {
            textObj = { text };
            const newObject = {
              id: Date.now() + Math.random(),
              type: 'text',
              value: text,
              x: canvasBounds.x + canvasBounds.width / 2,
              y: canvasBounds.y + canvasBounds.height / 2,
              fontSize: 20,
              fontFamily: 'Inter',
              fill: '#0288d1',
              align: 'left',
              lineHeight: 1.2,
              letterSpacing: 0,
              stroke: null,
              strokeWidth: 0,
              shadowOffsetX: 0,
              shadowOffsetY: 0,
              shadowBlur: 0,
              shadowOpacity: 0,
              shadowColor: '#000000',
              fontStyle: 'normal',
              textDecoration: 'none',
              side,
              zIndex: objects.length,
              width: Math.min(150, maxSize),
              height: Math.min(50, maxSize),
              rotation: 0,
              status: 'inside',
            };
            newObjects.push(newObject);
          }
          const updatedObjects = [...objects, ...newObjects];
          setObjects(updateObjectStatuses(updatedObjects));
          setSelectedObjectIds(new Set(newObjects.map((obj) => obj.id)));
          addToHistory(updatedObjects, size);
          handled = true;
        }
      }

      if (!handled && clipboard.length > 0) {
        newObjects = await Promise.all(clipboard.map(async (obj) => {
          const newId = Date.now() + Math.random();
          const newObject = {
            ...obj,
            id: newId,
            x: canvasBounds.x + canvasBounds.width / 2,
            y: canvasBounds.y + canvasBounds.height / 2,
            zIndex: objects.length + newObjects.length,
            side,
            status: 'inside',
          };
          if (obj.type === 'image' && obj.imageSrc) {
            try {
              const img = new window.Image();
              await new Promise((resolve, reject) => {
                img.onload = resolve;
                img.onerror = reject;
                img.src = obj.imageSrc;
              });
              newObject.image = img;
              delete newObject.imageSrc;
            } catch (err) {
              console.error('Failed to load image for paste:', err);
              return null;
            }
          } else if (obj.type === 'text') {
            newObject.fontSize = Number(obj.fontSize) || 20;
            newObject.fontFamily = obj.fontFamily || 'Inter';
            newObject.fill = obj.fill || '#0288d1';
            newObject.align = obj.align || 'left';
            newObject.lineHeight = Number(obj.lineHeight) || 1.2;
            newObject.letterSpacing = Number(obj.letterSpacing) || 0;
            newObject.stroke = obj.stroke || null;
            newObject.strokeWidth = Number(obj.strokeWidth) || 0;
            newObject.shadowOffsetX = Number(obj.shadowOffsetX) || 0;
            newObject.shadowOffsetY = Number(obj.shadowOffsetY) || 0;
            newObject.shadowBlur = Number(obj.shadowBlur) || 0;
            newObject.shadowOpacity = Number(obj.shadowOpacity) || 0;
            newObject.shadowColor = obj.shadowColor || '#000000';
            newObject.fontStyle = obj.fontStyle || 'normal';
            newObject.textDecoration = obj.textDecoration || 'none';
            newObject.width = Number(obj.width) || Math.min(150, maxSize);
            newObject.height = Number(obj.height) || Math.min(50, maxSize);
            newObject.rotation = Number(obj.rotation) || 0;
          }
          return newObject;
        }));
        newObjects = newObjects.filter(obj => obj !== null);
        const updatedObjects = [...objects, ...newObjects];
        setObjects(updateObjectStatuses(updatedObjects));
        setSelectedObjectIds(new Set(newObjects.map((obj) => obj.id)));
        addToHistory(updatedObjects, size);
      } else if (!handled) {
        setImageError('Буфер обмена пуст или содержит неподдерживаемый формат');
      }
    } catch (err) {
      console.error('Clipboard error:', err);
      setImageError('Ошибка доступа к буферу обмена');
      if (clipboard.length > 0) {
        newObjects = await Promise.all(clipboard.map(async (obj) => {
          const newId = Date.now() + Math.random();
          const newObject = {
            ...obj,
            id: newId,
            x: canvasBounds.x + canvasBounds.width / 2,
            y: canvasBounds.y + canvasBounds.height / 2,
            zIndex: objects.length + newObjects.length,
            side,
            status: 'inside',
          };
          if (obj.type === 'image' && obj.imageSrc) {
            try {
              const img = new window.Image();
              await new Promise((resolve, reject) => {
                img.onload = resolve;
                img.onerror = reject;
                img.src = obj.imageSrc;
              });
              newObject.image = img;
              delete newObject.imageSrc;
            } catch (err) {
              console.error('Failed to load image for paste:', err);
              return null;
            }
          } else if (obj.type === 'text') {
            newObject.fontSize = Number(obj.fontSize) || 20;
            newObject.fontFamily = obj.fontFamily || 'Inter';
            newObject.fill = obj.fill || '#0288d1';
            newObject.align = obj.align || 'left';
            newObject.lineHeight = Number(obj.lineHeight) || 1.2;
            newObject.letterSpacing = Number(obj.letterSpacing) || 0;
            newObject.stroke = obj.stroke || null;
            newObject.strokeWidth = Number(obj.strokeWidth) || 0;
            newObject.shadowOffsetX = Number(obj.shadowOffsetX) || 0;
            newObject.shadowOffsetY = Number(obj.shadowOffsetY) || 0;
            newObject.shadowBlur = Number(obj.shadowBlur) || 0;
            newObject.shadowOpacity = Number(obj.shadowOpacity) || 0;
            newObject.shadowColor = obj.shadowColor || '#000000';
            newObject.fontStyle = obj.fontStyle || 'normal';
            newObject.textDecoration = obj.textDecoration || 'none';
            newObject.width = Number(obj.width) || Math.min(150, maxSize);
            newObject.height = Number(obj.height) || Math.min(50, maxSize);
            newObject.rotation = Number(obj.rotation) || 0;
          }
          return newObject;
        }));
        newObjects = newObjects.filter(obj => obj !== null);
        const updatedObjects = [...objects, ...newObjects];
        setObjects(updateObjectStatuses(updatedObjects));
        setSelectedObjectIds(new Set(newObjects.map((obj) => obj.id)));
        addToHistory(updatedObjects, size);
      }
    }
    setGuides({ horizontal: [], vertical: [] });
  };

  const handleDeleteObject = (objectId) => {
    const idsToDelete = objectId ? [objectId] : Array.from(selectedObjectIds);
    if (idsToDelete.length === 0) return;
    const updatedObjects = objects.filter((obj) => !idsToDelete.includes(obj.id));
    setObjects(updatedObjects);
    setSelectedObjectIds(new Set());
    setActiveTextSettings('main');
    if (transformerRef.current) {
      transformerRef.current.nodes([]);
      transformerRef.current.getLayer()?.batchDraw();
    }
    setRotationAngle(null);
    setRotationAnchorPos(null);
    setDraggingObjectId(null);
    setCursorIndicator({ visible: false, x: 0, y: 0, text: '' });
    setImageLoading(false);
    setImageError(null);
    setFileInputKey(Date.now());
    setGuides({ horizontal: [], vertical: [] });
    addToHistory(updatedObjects, size);
  };

  const handleSave = async () => {
    if (!stageRef.current || !size) return;
    const stage = stageRef.current.getStage();
    const layer = stage.findOne('Layer');
    const originalSide = side;
    const sides = [];
    if (saveSides.front) sides.push('front');
    if (saveSides.back) sides.push('back');

    if (sides.length === 0) {
      alert('Пожалуйста, выберите хотя бы одну сторону (Лицевая или Обратная).');
      return;
    }

    const selectionRectNode = stage.findOne((node) => node.getClassName() === 'Rect' && node.fill() === 'rgba(0, 136, 209, 0.2)');
    const cursorIndicatorNode = stage.findOne((node) => node.getClassName() === 'Text' && node.text() === cursorIndicator.text);
    const guideNodes = stage.find((node) => node.getClassName() === 'Line');
    const transformerNode = stage.findOne('Transformer');

    if (selectionRectNode) selectionRectNode.visible(false);
    if (cursorIndicatorNode) cursorIndicatorNode.visible(false);
    guideNodes.forEach((node) => node.visible(false));
    if (transformerNode) transformerNode.visible(false);
    layer.batchDraw();

    for (const currentSide of sides) {
      setSide(currentSide);
      await new Promise(resolve => setTimeout(resolve, 100));
      layer.batchDraw();

      const mimeType = saveFormat === 'svg' ? 'image/svg+xml' : 'image/png';
      const extension = saveFormat === 'svg' ? 'svg' : 'png';

      const dataURL = stage.toDataURL({
        x: canvasBounds.x,
        y: canvasBounds.y,
        width: canvasBounds.width,
        height: canvasBounds.height,
        pixelRatio: saveFormat === 'png' ? 2 : 1,
        mimeType: mimeType,
      });

      const link = document.createElement('a');
      link.href = dataURL;
      link.download = `${selectedProduct || 'design'}_${currentSide}.${extension}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }

    setSide(originalSide);
    if (selectionRectNode) selectionRectNode.visible(selectionRect.visible);
    if (cursorIndicatorNode) cursorIndicatorNode.visible(cursorIndicator.visible);
    guideNodes.forEach((node) => node.visible(true));
    if (transformerNode) transformerNode.visible(true);
    layer.batchDraw();
    setShowSaveModal(false);
    setSaveSides({ front: true, back: false });
    setSaveFormat('png');
  };

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

      e.preventDefault();
      e.stopPropagation();

      const isCtrl = e.ctrlKey || e.metaKey;

      if (e.code === 'KeyZ' && isCtrl) {
        undo();
      } else if (e.code === 'KeyY' && isCtrl) {
        redo();
      } else if (e.code === 'KeyC' && isCtrl && selectedObjectIds.size > 0) {
        copySelectedObjects();
      } else if (e.code === 'KeyV' && isCtrl) {
        pasteObjects();
      } else if (e.code === 'KeyI' && isCtrl && selectedObjectIds.size > 0) {
        const selectedObject = objects.find((obj) => selectedObjectIds.has(obj.id));
        if (selectedObject && selectedObject.type === 'text') {
          const currentStyle = selectedObject.fontStyle.split(' ').filter(s => s);
          const isItalic = currentStyle.includes('italic');
          const newStyle = isItalic ? currentStyle.filter(s => s !== 'italic') : [...currentStyle, 'italic'];
          handleObjectUpdate('fontStyle', newStyle.join(' ') || 'normal');
        }
      } else if (e.code === 'KeyB' && isCtrl && selectedObjectIds.size > 0) {
        const selectedObject = objects.find((obj) => selectedObjectIds.has(obj.id));
        if (selectedObject && selectedObject.type === 'text') {
          const currentStyle = selectedObject.fontStyle.split(' ').filter(s => s);
          const isBold = currentStyle.includes('bold');
          const newStyle = isBold ? currentStyle.filter(s => s !== 'bold') : [...currentStyle, 'bold'];
          handleObjectUpdate('fontStyle', newStyle.join(' ') || 'normal');
        }
      } else if (e.code === 'KeyU' && isCtrl && selectedObjectIds.size > 0) {
        const selectedObject = objects.find((obj) => selectedObjectIds.has(obj.id));
        if (selectedObject && selectedObject.type === 'text') {
          handleObjectUpdate('textDecoration', selectedObject.textDecoration === 'underline' ? 'none' : 'underline');
        }
      } else if (e.code === 'Delete' && selectedObjectIds.size > 0) {
        handleDeleteObject();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedObjectIds, clipboard, objects, size, historyIndex]);

  const handleSizeChange = (e) => {
    const selectedSize = sizes[e.target.value] || sizes.standard90x50;
    const newSize = getMaximizedSize(selectedSize);
    setSize(newSize);
    const updatedObjects = objects.map((obj) => {
      if (obj.type === 'text') {
        return {
          ...obj,
          width: Math.max(minSize, Math.min(obj.width, maxSize)),
          height: Math.max(minSize, Math.min(obj.height, maxSize)),
          fontSize: Math.max(minFontSize, Math.min(obj.fontSize, maxFontSize)),
        };
      } else if (obj.type === 'image') {
        return {
          ...obj,
          width: Math.max(minSize, Math.min(obj.width, maxSize)),
          height: Math.max(minSize, Math.min(obj.height, maxSize)),
        };
      }
      return obj;
    });
    setObjects(updateObjectStatuses(updatedObjects));
    setGuides({ horizontal: [], vertical: [] });
    addToHistory(updatedObjects, newSize);
  };

  const handleSideChange = (newSide) => {
    setSide(newSide);
    setSelectedObjectIds(new Set());
    setActiveTextSettings('main');
    setFileInputKey(Date.now());
    setGuides({ horizontal: [], vertical: [] });
    addToHistory(objects, size);
  };

  const handleAddText = () => {
    const newObject = {
      id: Date.now(),
      type: 'text',
      value: 'Введите текст...',
      x: canvasBounds.x + canvasBounds.width / 2,
      y: canvasBounds.y + canvasBounds.height / 2,
      fontSize: 20,
      fontFamily: 'Inter',
      fill: '#0288d1',
      align: 'left',
      lineHeight: 1.2,
      letterSpacing: 0,
      stroke: null,
      strokeWidth: 0,
      shadowOffsetX: 0,
      shadowOffsetY: 0,
      shadowBlur: 0,
      shadowOpacity: 0,
      shadowColor: '#000000',
      fontStyle: 'normal',
      textDecoration: 'none',
      side,
      zIndex: objects.length,
      width: Math.min(150, maxSize),
      height: Math.min(50, maxSize),
      rotation: 0,
      status: 'inside',
    };
    const updatedObjects = [...objects, newObject];
    setObjects(updatedObjects);
    setSelectedObjectIds(new Set([newObject.id]));
    setActiveTextSettings('main');
    setGuides({ horizontal: [], vertical: [] });
    addToHistory(updatedObjects, size);
  };

  const handleAddImage = (e) => {
    const file = e.target.files[0];
    if (file && ['image/jpeg', 'image/png', 'image/svg+xml'].includes(file.type)) {
      setImageLoading(true);
      setImageError(null);
      const reader = new FileReader();
      reader.onload = () => {
        const img = new window.Image();
        img.src = reader.result;
        img.onload = () => {
          const aspectRatio = img.width / img.height;
          let width = Math.min(size.width * 0.5, maxSize);
          let height = width / aspectRatio;
          if (height > maxSize) {
            height = maxSize;
            width = height * aspectRatio;
          }
          width = Math.max(minSize, width);
          height = Math.max(minSize, height);
          const newObject = {
            id: Date.now(),
            type: 'image',
            image: img,
            x: canvasBounds.x + canvasBounds.width / 2,
            y: canvasBounds.y + canvasBounds.height / 2,
            width,
            height,
            rotation: 0,
            opacity: 1,
            side,
            zIndex: objects.length,
            status: 'inside',
          };
          const updatedObjects = [...objects, newObject];
          setObjects(updatedObjects);
          setSelectedObjectIds(new Set([newObject.id]));
          setImageLoading(false);
          setImageError(null);
          setFileInputKey(Date.now());
          e.target.value = null;
          setGuides({ horizontal: [], vertical: [] });
          addToHistory(updatedObjects, size);
        };
        img.onerror = () => {
          setImageError('Не удалось загрузить изображение');
          setImageLoading(false);
          setFileInputKey(Date.now());
          e.target.value = null;
        };
      };
      reader.onerror = () => {
        setImageError('Ошибка чтения файла');
        setImageLoading(false);
        setFileInputKey(Date.now());
        e.target.value = null;
      };
      reader.readAsDataURL(file);
    } else {
      setImageError('Неподдерживаемый формат файла');
      setImageLoading(false);
      setFileInputKey(Date.now());
      e.target.value = null;
    }
  };

  const handleObjectUpdate = (field, value) => {
    const updatedObjects = objects.map((obj) => {
      if (selectedObjectIds.has(obj.id)) {
        if (obj.type === 'text') {
          if (field === 'width') {
            value = Math.max(minSize, Math.min(value, workspaceSize.width));
          } else if (field === 'height') {
            value = Math.max(minSize, Math.min(value, workspaceSize.height));
          } else if (field === 'fontSize') {
            value = Math.max(minFontSize, Math.min(value, maxFontSize));
          } else if (field === 'rotation') {
            value = Number(value) % 360;
          } else if (field === 'fontStyle') {
            value = value.trim() || 'normal';
          } else if (field === 'textDecoration') {
            value = value === 'underline' ? 'underline' : 'none';
          } else if (field === 'lineHeight') {
            value = Math.max(0.8, Math.min(value, 2));
          } else if (field === 'shadowOffsetX' || field === 'shadowOffsetY') {
            value = Math.max(-10, Math.min(value, 10));
          } else if (field === 'shadowBlur') {
            value = Math.max(0, Math.min(value, 20));
          } else if (field === 'shadowOpacity') {
            value = Math.max(0, Math.min(value, 1));
          } else if (field === 'strokeWidth') {
            value = Math.max(0, Math.min(value, 1));
          }
        } else if (obj.type === 'image') {
          if (field === 'width') {
            value = Math.max(minSize, Math.min(value, workspaceSize.width));
          } else if (field === 'height') {
            value = Math.max(minSize, Math.min(value, workspaceSize.height));
          } else if (field === 'rotation') {
            value = Number(value) % 360;
          } else if (field === 'opacity') {
            value = Math.max(0, Math.min(value, 1));
          }
        }
        return { ...obj, [field]: value };
      }
      return obj;
    });
    setObjects(updateObjectStatuses(updatedObjects));
    setGuides({ horizontal: [], vertical: [] });
    addToHistory(updatedObjects, size);
  };

  const handleZIndexChange = (direction) => {
    let updatedObjects = [...objects];
    const selectedIndices = updatedObjects
      .map((obj, i) => (selectedObjectIds.has(obj.id) ? i : -1))
      .filter((i) => i !== -1)
      .sort((a, b) => direction === 'up' ? b - a : a - b);

    if (direction === 'up') {
      selectedIndices.forEach((index) => {
        if (index < updatedObjects.length - 1) {
          [updatedObjects[index], updatedObjects[index + 1]] = [updatedObjects[index + 1], updatedObjects[index]];
        }
      });
    } else if (direction === 'down') {
      selectedIndices.forEach((index) => {
        if (index > 0) {
          [updatedObjects[index], updatedObjects[index - 1]] = [updatedObjects[index - 1], updatedObjects[index]];
        }
      });
    }
    updatedObjects.forEach((obj, i) => (obj.zIndex = i));
    setObjects(updateObjectStatuses(updatedObjects));
    setGuides({ horizontal: [], vertical: [] });
    addToHistory(updatedObjects, size);
  };

  const handleLayerDragStart = (e, id) => {
    setDraggedLayerId(id);
    e.target.classList.add('bg-gray-200');
  };

  const handleLayerDragOver = (e) => {
    e.preventDefault();
  };

  const handleLayerDrop = (e, targetId) => {
    e.preventDefault();
    if (draggedLayerId === null || draggedLayerId === targetId) {
      setDraggedLayerId(null);
      return;
    }

    const updatedObjects = [...objects];
    const draggedIndex = updatedObjects.findIndex((obj) => obj.id === draggedLayerId && obj.side === side);
    const targetIndex = updatedObjects.findIndex((obj) => obj.id === targetId && obj.side === side);

    if (draggedIndex === -1 || targetIndex === -1) {
      setDraggedLayerId(null);
      return;
    }

    const [draggedObject] = updatedObjects.splice(draggedIndex, 1);
    updatedObjects.splice(targetIndex, 0, draggedObject);

    updatedObjects.forEach((obj, i) => (obj.zIndex = i));
    setObjects(updateObjectStatuses(updatedObjects));
    setGuides({ horizontal: [], vertical: [] });
    addToHistory(updatedObjects, size);
    setDraggedLayerId(null);
    e.target.classList.remove('bg-gray-200');
  };

  const handleLayerDragEnd = (e) => {
    setDraggedLayerId(null);
    e.target.classList.remove('bg-gray-200');
  };

  const handleToggleShadow = () => {
    const selectedObject = objects.find((obj) => selectedObjectIds.has(obj.id));
    if (activeTextSettings !== 'shadow' && selectedObject && selectedObject.type === 'text') {
      if (selectedObject.shadowOpacity === 0) {
        const updatedObjects = objects.map((obj) => {
          if (selectedObjectIds.has(obj.id)) {
            return {
              ...obj,
              shadowOffsetX: 2,
              shadowOffsetY: 2,
              shadowBlur: 0,
              shadowOpacity: 0.5,
              shadowColor: '#000000',
            };
          }
          return obj;
        });
        setObjects(updateObjectStatuses(updatedObjects));
        addToHistory(updatedObjects, size);
      }
    }
    setActiveTextSettings(activeTextSettings === 'shadow' ? 'main' : 'shadow');
  };

  const selectedObject = objects.find((obj) => selectedObjectIds.has(obj.id));

  if (!selectedProduct || !size) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="max-w-4xl w-full p-6">
          <h1 className="text-3xl font-bold text-center mb-8 text-gray-800">Выберите продукт</h1>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4">
            {products.map((product) => (
              <button
                key={product}
                onClick={() => handleProductSelect(product)}
                className="bg-primary text-white px-4 py-2 rounded-lg hover:bg-primary/80 hover:shadow-md transition duration-200"
              >
                {product}
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100">
      <div className="bg-white shadow p-4 flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <button
            onClick={undo}
            disabled={historyIndex <= 0}
            className="flex items-center bg-primary text-white px-4 py-2 rounded-lg hover:bg-primary/80 hover:shadow-md disabled:opacity-50 transition duration-200"
          >
            <FaUndo className="mr-2" /> Отмена
          </button>
          <button
            onClick={redo}
            disabled={historyIndex >= history.length - 1}
            className="flex items-center bg-primary text-white px-4 py-2 rounded-lg hover:bg-primary/80 hover:shadow-md disabled:opacity-50 transition duration-200"
          >
            <FaRedo className="mr-2" /> Повторить
          </button>
          <button
            onClick={() => setShowSaveModal(true)}
            className="flex items-center bg-primary text-white px-4 py-2 rounded-lg hover:bg-primary/80 hover:shadow-md transition duration-200"
          >
            <FaSave className="mr-2" /> Сохранить
          </button>
        </div>
      </div>

      {showSaveModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg shadow-lg w-96">
            <h2 className="text-lg font-bold mb-4 text-gray-800">Выберите параметры сохранения</h2>
            <div className="mb-4">
              <h3 className="text-sm font-medium mb-2 text-gray-800">Сторона</h3>
              <label className="flex items-center mb-2">
                <input
                  type="checkbox"
                  checked={saveSides.front}
                  onChange={(e) => setSaveSides({ ...saveSides, front: e.target.checked })}
                  className="mr-2 accent-primary"
                />
                Лицевая
              </label>
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={saveSides.back}
                  onChange={(e) => setSaveSides({ ...saveSides, back: e.target.checked })}
                  className="mr-2 accent-primary"
                />
                Обратная
              </label>
            </div>
            <div className="mb-4">
              <h3 className="text-sm font-medium mb-2 text-gray-800">Формат</h3>
              <select
                value={saveFormat}
                onChange={(e) => setSaveFormat(e.target.value)}
                className="w-full border border-gray-300 rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-primary text-gray-800"
              >
                <option value="png">PNG</option>
                <option value="svg">SVG</option>
              </select>
            </div>
            <div className="flex justify-end space-x-2">
              <button
                onClick={() => {
                  setShowSaveModal(false);
                  setSaveSides({ front: true, back: false });
                  setSaveFormat('png');
                }}
                className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition duration-200"
              >
                Отмена
              </button>
              <button
                onClick={handleSave}
                className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/80 transition duration-200"
              >
                Сохранить
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="flex">
        <div className="w-64 bg-white p-4 rounded-lg shadow">
          <h2 className="text-lg font-bold mb-4 text-gray-800">Настройки</h2>
          {selectedProduct === 'Визитки' && (
            <div className="mb-4">
              <label className="block text-sm font-medium mb-1 text-gray-800">Размер визитки</label>
              <select
                onChange={handleSizeChange}
                className="w-full border border-gray-300 rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-primary text-gray-800"
                defaultValue="standard90x50"
              >
                <option value="euro55x85">Евро 55×85 мм</option>
                <option value="euro85x55">Евро 85×55 мм</option>
                <option value="standard50x90">Стандартная 50×90 мм</option>
                <option value="standard90x50">Стандартная 90×50 мм</option>
              </select>
            </div>
          )}
          <div className="mb-4">
            <button
              onClick={handleAddText}
              className="flex items-center bg-primary text-white px-4 py-2 rounded-lg hover:bg-primary/80 hover:shadow-md w-full mb-2 transition duration-200"
            >
              <FaPlus className="mr-2" /> Текст
            </button>
            <label className="flex items-center bg-primary text-white px-4 py-2 rounded-lg hover:bg-primary/80 hover:shadow-md cursor-pointer w-full mb-2 transition duration-200">
              <FaImage className="mr-2" /> Изображение
              <input
                key={fileInputKey}
                type="file"
                accept="image/jpeg,image/png,image/svg+xml"
                onChange={handleAddImage}
                className="hidden"
                disabled={imageLoading}
              />
            </label>
            {imageLoading && <p className="text-sm text-gray-500">Загрузка...</p>}
            {imageError && <p className="text-sm text-red-500">{imageError}</p>}
          </div>
          <div className="mb-4">
            <label className="block text-sm font-medium mb-1 text-gray-800">Сторона</label>
            <div className="flex space-x-2">
              <button
                onClick={() => handleSideChange('front')}
                className={`flex-1 px-4 py-2 rounded ${side === 'front' ? 'bg-primary text-white' : 'bg-gray-200 text-gray-700'} hover:bg-primary/80 hover:shadow-md transition duration-200`}
              >
                Лицевая
              </button>
              <button
                onClick={() => handleSideChange('back')}
                className={`flex-1 px-4 py-2 rounded ${side === 'back' ? 'bg-primary text-white' : 'bg-gray-200 text-gray-700'} hover:bg-primary/80 hover:shadow-md transition duration-200`}
              >
                Обратная
              </button>
            </div>
          </div>
          <div>
            <h3 className="text-sm font-medium mb-2 text-gray-800">Слои</h3>
            <ul className="border border-gray-200 rounded p-2 max-h-64 overflow-y-auto">
              {objects
                .filter((obj) => obj.side === side)
                .sort((a, b) => b.zIndex - a.zIndex)
                .map((obj) => {
                  const node = stageRef.current?.findOne(`#${obj.id}`);
                  const status = getObjectStatus(obj, node);
                  return (
                    <li
                      key={obj.id}
                      draggable
                      onDragStart={(e) => handleLayerDragStart(e, obj.id)}
                      onDragOver={handleLayerDragOver}
                      onDrop={(e) => handleLayerDrop(e, obj.id)}
                      onDragEnd={handleLayerDragEnd}
                      onClick={(e) => {
                        const newSelected = new Set(e.shiftKey ? selectedObjectIds : []);
                        if (newSelected.has(obj.id)) {
                          newSelected.delete(obj.id);
                        } else {
                          newSelected.add(obj.id);
                        }
                        setSelectedObjectIds(newSelected);
                        if (obj.type === 'text') setActiveTextSettings('main');
                        if (transformerRef.current && stageRef.current) {
                          const node = stageRef.current.findOne(`#${obj.id}`);
                          if (node) {
                            transformerRef.current.nodes([node]);
                            transformerRef.current.getLayer()?.batchDraw();
                          }
                        }
                      }}
                      className={`p-2 cursor-move rounded flex justify-between items-center ${selectedObjectIds.has(obj.id) ? 'bg-blue-100' : ''} ${draggedLayerId === obj.id ? 'bg-gray-200' : ''}`}
                    >
                      <span className="text-gray-800">
                        {obj.type === 'text' ? `Текст: ${obj.value.slice(0, 20)}...` : obj.type}
                        {status === 'partial' && <span className="ml-2">⚠️</span>}
                        {status === 'outside' && <span className="ml-2 text-red-500">❗</span>}
                      </span>
                      <div className="flex space-x-1">
                        <button
                          onClick={() => handleZIndexChange('up')}
                          className="text-xs p-1 hover:bg-gray-200 rounded"
                        >
                          ↑
                        </button>
                        <button
                          onClick={() => handleZIndexChange('down')}
                          className="text-xs p-1 hover:bg-gray-200 rounded"
                        >
                          ↓
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteObject(obj.id);
                          }}
                          className="text-xs p-1 hover:bg-red-200 rounded"
                        >
                          <FaTrash />
                        </button>
                      </div>
                    </li>
                  );
                })}
            </ul>
          </div>
        </div>

        <div className="flex-1">
          <Canvas
            stageRef={stageRef}
            transformerRef={transformerRef}
            objects={objects}
            setObjects={setObjects}
            selectedObjectIds={selectedObjectIds}
            setSelectedObjectIds={setSelectedObjectIds}
            side={side}
            size={size}
            workspaceSize={workspaceSize}
            minSize={minSize}
            maxSize={maxSize}
            minFontSize={minFontSize}
            maxFontSize={maxFontSize}
            selectionRect={selectionRect}
            setSelectionRect={setSelectionRect}
            dragStartPos={dragStartPos}
            setDragStartPos={setDragStartPos}
            draggingObjectId={draggingObjectId}
            setDraggingObjectId={setDraggingObjectId}
            cursorIndicator={cursorIndicator}
            setCursorIndicator={setCursorIndicator}
            rotationAngle={rotationAngle}
            setRotationAngle={setRotationAngle}
            rotationAnchorPos={rotationAnchorPos}
            setRotationAnchorPos={setRotationAnchorPos}
            addToHistory={addToHistory}
            updateObjectStatuses={updateObjectStatuses}
            getObjectStatus={getObjectStatus}
            cursorPos={cursorPos}
            setCursorPos={setCursorPos}
            handleObjectUpdate={handleObjectUpdate}
            guides={guides}
            setGuides={setGuides}
            canvasBounds={canvasBounds}
          />
        </div>

        <div className="w-64 bg-white p-4 rounded-lg shadow">
          <h2 className="text-lg font-bold mb-4 text-gray-800">Свойства</h2>
          {selectedObject && selectedObjectIds.size === 1 ? (
            <>
              {selectedObject.type === 'text' && (
                <>
                  <div className="mb-4 flex space-x-2 flex-wrap">
                    <button
                      onClick={() => {
                        const currentStyle = selectedObject.fontStyle.split(' ').filter(s => s);
                        const isItalic = currentStyle.includes('italic');
                        const newStyle = isItalic ? currentStyle.filter(s => s !== 'italic') : [...currentStyle, 'italic'];
                        handleObjectUpdate('fontStyle', newStyle.join(' ') || 'normal');
                      }}
                      className={`p-2 rounded ${selectedObject.fontStyle.includes('italic') ? 'bg-primary text-white' : 'bg-gray-200 text-gray-700'} hover:bg-primary/80 hover:shadow-md transition duration-200`}
                      title="Курсив"
                    >
                      <FaItalic />
                    </button>
                    <button
                      onClick={() => {
                        const currentStyle = selectedObject.fontStyle.split(' ').filter(s => s);
                        const isBold = currentStyle.includes('bold');
                        const newStyle = isBold ? currentStyle.filter(s => s !== 'bold') : [...currentStyle, 'bold'];
                        handleObjectUpdate('fontStyle', newStyle.join(' ') || 'normal');
                      }}
                      className={`p-2 rounded ${selectedObject.fontStyle.includes('bold') ? 'bg-primary text-white' : 'bg-gray-200 text-gray-700'} hover:bg-primary/80 hover:shadow-md transition duration-200`}
                      title="Жирный"
                    >
                      <FaBold />
                    </button>
                    <button
                      onClick={() => handleObjectUpdate('textDecoration', selectedObject.textDecoration === 'underline' ? 'none' : 'underline')}
                      className={`p-2 rounded ${selectedObject.textDecoration === 'underline' ? 'bg-primary text-white' : 'bg-gray-200 text-gray-700'} hover:bg-primary/80 hover:shadow-md transition duration-200`}
                      title="Подчёркнутый"
                    >
                      <FaUnderline />
                    </button>
                    <button
                      onClick={handleToggleShadow}
                      className={`p-2 rounded ${activeTextSettings === 'shadow' ? 'bg-primary text-white' : 'bg-gray-200 text-gray-700'} hover:bg-primary/80 hover:shadow-md transition duration-200 flex items-center justify-center`}
                      title="Тень"
                    >
                      <span style={{ textShadow: 'rgba(0, 0, 0, 0.4) 2.1px 2.1px' }} className="text-sm font-medium">Абв</span>
                    </button>
                    <button
                      onClick={() => setActiveTextSettings(activeTextSettings === 'stroke' ? 'main' : 'stroke')}
                      className={`p-2 rounded ${activeTextSettings === 'stroke' ? 'bg-primary text-white' : 'bg-gray-200 text-gray-700'} hover:bg-primary/80 hover:shadow-md transition duration-200 flex items-center justify-center`}
                      title="Обводка"
                    >
                      <span style={{ WebkitTextStroke: '0.3px #ff0000' }} className="text-sm font-medium">Абв</span>
                    </button>
                  </div>
                  {activeTextSettings === 'main' && (
                    <>
                      <div className="mb-4">
                        <label className="block text-sm font-medium mb-1 text-gray-800">Текст</label>
                        <textarea
                          value={selectedObject.value || ''}
                          onChange={(e) => handleObjectUpdate('value', e.target.value)}
                          className="w-full border border-gray-300 rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-primary text-gray-800"
                        />
                      </div>
                      <div className="mb-4">
                        <label className="block text-sm font-medium mb-1 text-gray-800">Шрифт</label>
                        <select
                          value={selectedObject.fontFamily || 'Inter'}
                          onChange={(e) => handleObjectUpdate('fontFamily', e.target.value)}
                          className="w-full border border-gray-300 rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-primary text-gray-800"
                        >
                          {fonts.map((font) => (
                            <option key={font} value={font}>
                              {font}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="mb-4">
                        <label className="block text-sm font-medium mb-1 text-gray-800">Размер шрифта (px)</label>
                        <input
                          type="number"
                          value={selectedObject.fontSize || 20}
                          onChange={(e) => handleObjectUpdate('fontSize', Number(e.target.value))}
                          min={minFontSize}
                          max={maxFontSize}
                          className="w-full border border-gray-300 rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-primary text-gray-800"
                        />
                      </div>
                      <div className="mb-4">
                        <label className="block text-sm font-medium mb-1 text-gray-800">Ширина (px)</label>
                        <input
                          type="number"
                          value={selectedObject.width || 150}
                          onChange={(e) => handleObjectUpdate('width', Number(e.target.value))}
                          min={minSize}
                          max={workspaceSize.width}
                          className="w-full border border-gray-300 rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-primary text-gray-800"
                        />
                      </div>
                      <div className="mb-4">
                        <label className="block text-sm font-medium mb-1 text-gray-800">Высота (px)</label>
                        <input
                          type="number"
                          value={selectedObject.height || 50}
                          onChange={(e) => handleObjectUpdate('height', Number(e.target.value))}
                          min={minSize}
                          max={workspaceSize.height}
                          className="w-full border border-gray-300 rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-primary text-gray-800"
                        />
                      </div>
                      <div className="mb-4">
                        <label className="block text-sm font-medium mb-1 text-gray-800">Поворот (градусы)</label>
                        <input
                          type="number"
                          value={selectedObject.rotation || 0}
                          onChange={(e) => handleObjectUpdate('rotation', Number(e.target.value))}
                          className="w-full border border-gray-300 rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-primary text-gray-800"
                        />
                      </div>
                      <div className="mb-4">
                        <label className="block text-sm font-medium mb-1 text-gray-800">Цвет</label>
                        <input
                          type="color"
                          value={selectedObject.fill || '#0288d1'}
                          onChange={(e) => handleObjectUpdate('fill', e.target.value)}
                          className="w-full h-10 border border-gray-300 rounded"
                        />
                      </div>
                      <div className="mb-4">
                        <label className="block text-sm font-medium mb-1 text-gray-800">Выравнивание</label>
                        <select
                          value={selectedObject.align || 'left'}
                          onChange={(e) => handleObjectUpdate('align', e.target.value)}
                          className="w-full border border-gray-300 rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-primary text-gray-800"
                        >
                          <option value="left">По левому краю</option>
                          <option value="center">По центру</option>
                          <option value="right">По правому краю</option>
                          <option value="justify">По ширине</option>
                        </select>
                      </div>
                      <div className="mb-4">
                        <label className="block text-sm font-medium mb-1 text-gray-800">Межстрочный интервал</label>
                        <input
                          type="number"
                          value={selectedObject.lineHeight || 1.2}
                          onChange={(e) => handleObjectUpdate('lineHeight', Number(e.target.value))}
                          step="0.1"
                          min="0.8"
                          max="2"
                          className="w-full border border-gray-300 rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-primary text-gray-800"
                        />
                      </div>
                      <div className="mb-4">
                        <label className="block text-sm font-medium mb-1 text-gray-800">Межбуквенный интервал (px)</label>
                        <input
                          type="number"
                          value={selectedObject.letterSpacing || 0}
                          onChange={(e) => handleObjectUpdate('letterSpacing', Number(e.target.value))}
                          step="0.1"
                          className="w-full border border-gray-300 rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-primary text-gray-800"
                        />
                      </div>
                    </>
                  )}
                  {activeTextSettings === 'shadow' && (
                    <div className="mb-4">
                      <label className="block text-sm font-medium mb-1 text-gray-800">Тень</label>
                      <div className="mb-2">
                        <label className="block text-xs text-gray-600">Цвет тени</label>
                        <input
                          type="color"
                          value={selectedObject.shadowColor || '#000000'}
                          onChange={(e) => handleObjectUpdate('shadowColor', e.target.value)}
                          className="w-full h-10 border border-gray-300 rounded"
                        />
                      </div>
                      <div className="mb-2">
                        <label className="block text-xs text-gray-600">Смещение X</label>
                        <input
                          type="range"
                          value={selectedObject.shadowOffsetX || 0}
                          onChange={(e) => handleObjectUpdate('shadowOffsetX', Number(e.target.value))}
                          min="-10"
                          max="10"
                          step="0.1"
                          className="w-full accent-[#6ab8ee]"
                        />
                        <span className="text-xs text-gray-600">{selectedObject.shadowOffsetX || 0}</span>
                      </div>
                      <div className="mb-2">
                        <label className="block text-xs text-gray-600">Смещение Y</label>
                        <input
                          type="range"
                          value={selectedObject.shadowOffsetY || 0}
                          onChange={(e) => handleObjectUpdate('shadowOffsetY', Number(e.target.value))}
                          min="-10"
                          max="10"
                          step="0.1"
                          className="w-full accent-[#6ab8ee]"
                        />
                        <span className="text-xs text-gray-600">{selectedObject.shadowOffsetY || 0}</span>
                      </div>
                      <div className="mb-2">
                        <label className="block text-xs text-gray-600">Размытие</label>
                        <input
                          type="range"
                          value={selectedObject.shadowBlur || 0}
                          onChange={(e) => handleObjectUpdate('shadowBlur', Number(e.target.value))}
                          min="0"
                          max="20"
                          step="0.1"
                          className="w-full accent-[#6ab8ee]"
                        />
                        <span className="text-xs text-gray-600">{selectedObject.shadowBlur || 0}</span>
                      </div>
                      <div className="mb-2">
                        <label className="block text-xs text-gray-600">Прозрачность</label>
                        <input
                          type="range"
                          value={selectedObject.shadowOpacity || 0}
                          onChange={(e) => handleObjectUpdate('shadowOpacity', Number(e.target.value))}
                          min="0"
                          max="1"
                          step="0.01"
                          className="w-full accent-[#6ab8ee]"
                        />
                        <span className="text-xs text-gray-600">{selectedObject.shadowOpacity || 0}</span>
                      </div>
                    </div>
                  )}
                  {activeTextSettings === 'stroke' && (
                    <div className="mb-4">
                      <label className="block text-sm font-medium mb-1 text-gray-800">Обводка</label>
                      <div className="mb-2">
                        <label className="block text-xs text-gray-600">Цвет обводки</label>
                        <input
                          type="color"
                          value={selectedObject.stroke || '#000000'}
                          onChange={(e) => handleObjectUpdate('stroke', e.target.value)}
                          className="w-full h-10 border border-gray-300 rounded"
                        />
                      </div>
                      <div className="mb-2">
                        <label className="block text-xs text-gray-600">Толщина обводки</label>
                        <input
                          type="range"
                          value={selectedObject.strokeWidth || 0}
                          onChange={(e) => handleObjectUpdate('strokeWidth', Number(e.target.value))}
                          min="0"
                          max="1"
                          step="0.01"
                          className="w-full accent-[#6ab8ee]"
                        />
                        <span className="text-xs text-gray-600">{selectedObject.strokeWidth || 0}</span>
                      </div>
                    </div>
                  )}
                </>
              )}
              {selectedObject.type === 'image' && (
                <>
                  <div className="mb-4">
                    <label className="block text-sm font-medium mb-1 text-gray-800">Ширина (px)</label>
                    <input
                      type="number"
                      value={selectedObject.width || 0}
                      onChange={(e) => handleObjectUpdate('width', Number(e.target.value))}
                      min={minSize}
                      max={workspaceSize.width}
                      className="w-full border border-gray-300 rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-primary text-gray-800"
                    />
                  </div>
                  <div className="mb-4">
                    <label className="block text-sm font-medium mb-1 text-gray-800">Высота (px)</label>
                    <input
                      type="number"
                      value={selectedObject.height || 0}
                      onChange={(e) => handleObjectUpdate('height', Number(e.target.value))}
                      min={minSize}
                      max={workspaceSize.height}
                      className="w-full border border-gray-300 rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-primary text-gray-800"
                    />
                  </div>
                  <div className="mb-4">
                    <label className="block text-sm font-medium mb-1 text-gray-800">Поворот (градусы)</label>
                    <input
                      type="number"
                      value={selectedObject.rotation || 0}
                      onChange={(e) => handleObjectUpdate('rotation', Number(e.target.value))}
                      className="w-full border border-gray-300 rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-primary text-gray-800"
                    />
                  </div>
                  <div className="mb-4">
                    <label className="block text-sm font-medium mb-1 text-gray-800">Прозрачность</label>
                    <input
                      type="range"
                      value={selectedObject.opacity || 1}
                      onChange={(e) => handleObjectUpdate('opacity', Number(e.target.value))}
                      min="0"
                      max="1"
                      step="0.01"
                      className="w-full accent-[#6ab8ee]"
                    />
                    <span className="text-xs text-gray-600">{selectedObject.opacity || 1}</span>
                  </div>
                </>
              )}
            </>
          ) : (
            <p className="text-gray-500">Выберите объект для редактирования</p>
          )}
        </div>
      </div>
    </div>
  );
}