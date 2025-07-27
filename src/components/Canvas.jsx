import { useEffect, useState } from 'react';
import { Stage, Layer, Rect, Text, Image as KonvaImage, Transformer, Line } from 'react-konva';
import Konva from 'konva';

export default function Canvas({
  stageRef,
  transformerRef,
  objects,
  setObjects,
  selectedObjectIds,
  setSelectedObjectIds,
  side,
  size,
  workspaceSize,
  minSize,
  minFontSize,
  maxFontSize,
  selectionRect,
  setSelectionRect,
  dragStartPos,
  setDragStartPos,
  draggingObjectId,
  setDraggingObjectId,
  cursorIndicator,
  setCursorIndicator,
  rotationAngle,
  setRotationAngle,
  rotationAnchorPos,
  setRotationAnchorPos,
  addToHistory,
  updateObjectStatuses,
  getObjectStatus,
  cursorPos,
  setCursorPos,
  handleObjectUpdate,
}) {
  const [clickStartPos, setClickStartPos] = useState(null);
  const [guides, setGuides] = useState({ horizontal: [], vertical: [] });

  // Canvas boundaries for snapping
  const canvasBounds = {
    x: (workspaceSize.width - size.width) / 2,
    y: (workspaceSize.height - size.height) / 2,
    width: size.width,
    height: size.height,
  };

  // PowerPoint-like grid size (e.g., 10 pixels)
  const gridSize = 1;

  // Rotation snapping angles (in degrees)
  const snapAngles = [0, 45, 90, 135, 180, -45, -90, -135, -180];
  const snapTolerance = 5; // Degrees tolerance for snapping

  useEffect(() => {
    const stage = stageRef.current?.getStage()?.container();
    if (stage) {
      stage.tabIndex = 1;
      stage.focus();
      const handleStageClick = () => {
        stage.focus();
      };
      stage.addEventListener('click', handleStageClick);
      return () => stage.removeEventListener('click', handleStageClick);
    }
  }, [stageRef]);

  useEffect(() => {
    if (selectedObjectIds.size > 0 && transformerRef.current && stageRef.current) {
      const selectedNodes = Array.from(selectedObjectIds)
        .map((id) => stageRef.current.findOne(`#${id}`))
        .filter((node) => node);
      transformerRef.current.nodes(selectedNodes);
      transformerRef.current.getLayer().batchDraw();
        } else if (transformerRef.current) {
      transformerRef.current.nodes([]);
      transformerRef.current.getLayer().batchDraw();
    }
  }, [selectedObjectIds, objects, stageRef, transformerRef]);

  const handleStageMouseDown = (e) => {
    const stage = e.target.getStage();
    const pos = stage.getPointerPosition();
    setCursorPos(pos);
    setClickStartPos(pos);
    if (e.target === stage) {
      const newSelected = new Set(e.evt.shiftKey ? selectedObjectIds : []);
      setSelectedObjectIds(newSelected);
      setDragStartPos(pos);
      setSelectionRect({ visible: true, x: pos.x, y: pos.y, width: 0, height: 0 });
      setGuides({ horizontal: [], vertical: [] });
    } else {
      const id = Number(e.target.id());
      const obj = objects.find((o) => o.id === id && o.side === side);
      if (obj) {
        const newSelected = new Set(e.evt.shiftKey ? selectedObjectIds : []);
        if (newSelected.has(obj.id)) {
          newSelected.delete(obj.id);
        } else {
          newSelected.add(obj.id);
        }
        setSelectedObjectIds(newSelected);
      }
    }
  };

  const handleStageMouseMove = (e) => {
    const stage = e.target.getStage();
    const pos = stage.getPointerPosition();
    setCursorPos(pos);
    if (!dragStartPos) return;
    setSelectionRect({
      visible: true,
      x: Math.min(dragStartPos.x, pos.x),
      y: Math.min(dragStartPos.y, pos.y),
      width: Math.abs(pos.x - dragStartPos.x),
      height: Math.abs(pos.y - dragStartPos.y),
    });
  };

  const handleStageMouseUp = (e) => {
    const stage = e.target.getStage();
    const pos = stage.getPointerPosition();
    if (clickStartPos && !dragStartPos) {
      const id = Number(e.target.id());
      const obj = objects.find((o) => o.id === id && o.side === side);
      if (obj && obj.type === 'text') {
        const distance = Math.sqrt(
          Math.pow(pos.x - clickStartPos.x, 2) + Math.pow(pos.y - clickStartPos.y, 2)
        );
        if (distance < 5) {
          handleTextDblClick(obj);
        }
      }
    }
    if (!dragStartPos) {
      setClickStartPos(null);
      return;
    }
    const selectedIds = new Set(selectedObjectIds);
    objects.forEach((obj) => {
      if (obj.side !== side) return;
      const node = stageRef.current.findOne(`#${obj.id}`);
      if (node) {
        const box = node.getClientRect();
        const isIntersecting =
          box.x < selectionRect.x + selectionRect.width &&
          box.x + box.width > selectionRect.x &&
          box.y < selectionRect.y + selectionRect.height &&
          box.y + box.height > selectionRect.y;
        if (isIntersecting) {
          selectedIds.add(obj.id);
        }
      }
    });
    setSelectedObjectIds(selectedIds);
    setSelectionRect({ visible: false, x: 0, y: 0, width: 0, height: 0 });
    setDragStartPos(null);
    setClickStartPos(null);
    setGuides({ horizontal: [], vertical: [] });
    addToHistory(objects, size);
  };

  const handleDragStart = (e, id) => {
    setDraggingObjectId(id);
    ekspose, stage = e.target.getStage();
    const pos = stage.getPointerPosition();
    const node = stage.findOne(`#${id}`);
    const status = getObjectStatus(objects.find((obj) => obj.id === id), node);
    setCursorIndicator({
      visible: true,
      x: pos.x + 10,
      y: pos.y - 20,
      text: status === 'partial' ? '⚠️' : status === 'outside' ? '❗' : '',
    });
  };

  const handleDragMove = (e, id) => {
    const stage = e.target.getStage();
    const node = e.target;
    const pos = stage.getPointerPosition();
    const obj = objects.find((o) => o.id === id);
    const status = getObjectStatus(obj, node);

    let width, height;
    if (obj.type === 'image') {
      width = obj.width;
      height = obj.height;
    } else {
      width = node.width() * node.scaleX();
      height = node.height() * node.scaleY();
    }

    const snapTolerance = 5;
    let newX = node.x();
    let newY = node.y();
    let horizontalGuides = [];
    let verticalGuides = [];

    // Get the bounding box of the dragged object, accounting for rotation
    const box = node.getClientRect();
    const objectLeft = box.x;
    const objectRight = box.x + box.width;
    const objectTop = box.y;
    const objectBottom = box.y + box.height;
    const objectCenterX = box.x + box.width / 2;
    const objectCenterY = box.y + box.height / 2;

    // Snap to canvas edges and center with grid
    const canvasLeft = canvasBounds.x;
    const canvasRight = canvasBounds.x + canvasBounds.width;
    const canvasTop = canvasBounds.y;
    const canvasBottom = canvasBounds.y + canvasBounds.height;
    const canvasCenterX = canvasBounds.x + canvasBounds.width / 2;
    const canvasCenterY = canvasBounds.y + canvasBounds.height / 2;

    // Snap to grid
    newX = Math.round(node.x() / gridSize) * gridSize;
    newY = Math.round(node.y() / gridSize) * gridSize;

    // Snap to canvas edges and center
    // Left edge
    if (Math.abs(objectLeft - canvasLeft) <= snapTolerance) {
      newX = canvasLeft + box.width / 2;
      verticalGuides.push(canvasLeft);
    } else if (Math.abs(objectRight - canvasLeft) <= snapTolerance) {
      newX = canvasLeft - box.width / 2;
      verticalGuides.push(canvasLeft);
    }
    // Right edge
    if (Math.abs(objectRight - canvasRight) <= snapTolerance) {
      newX = canvasRight - box.width / 2;
      verticalGuides.push(canvasRight);
    } else if (Math.abs(objectLeft - canvasRight) <= snapTolerance) {
      newX = canvasRight + box.width / 2;
      verticalGuides.push(canvasRight);
    }
    // Center X
    if (Math.abs(objectCenterX - canvasCenterX) <= snapTolerance) {
      newX = canvasCenterX;
      verticalGuides.push(canvasCenterX);
    } else if (Math.abs(objectLeft - canvasCenterX) <= snapTolerance) {
      newX = canvasCenterX + box.width / 2;
      verticalGuides.push(canvasCenterX);
    } else if (Math.abs(objectRight - canvasCenterX) <= snapTolerance) {
      newX = canvasCenterX - box.width / 2;
      verticalGuides.push(canvasCenterX);
    }
    // Top edge
    if (Math.abs(objectTop - canvasTop) <= snapTolerance) {
      newY = canvasTop + box.height / 2;
      horizontalGuides.push(canvasTop);
    } else if (Math.abs(objectBottom - canvasTop) <= snapTolerance) {
      newY = canvasTop - box.height / 2;
      horizontalGuides.push(canvasTop);
    }
    // Bottom edge
    if (Math.abs(objectBottom - canvasBottom) <= snapTolerance) {
      newY = canvasBottom - box.height / 2;
      horizontalGuides.push(canvasBottom);
    } else if (Math.abs(objectTop - canvasBottom) <= snapTolerance) {
      newY = canvasBottom + box.height / 2;
      horizontalGuides.push(canvasBottom);
    }
    // Center Y
    if (Math.abs(objectCenterY - canvasCenterY) <= snapTolerance) {
      newY = canvasCenterY;
      horizontalGuides.push(canvasCenterY);
    } else if (Math.abs(objectTop - canvasCenterY) <= snapTolerance) {
      newY = canvasCenterY + box.height / 2;
      horizontalGuides.push(canvasCenterY);
    } else if (Math.abs(objectBottom - canvasCenterY) <= snapTolerance) {
      newY = canvasCenterY - box.height / 2;
      horizontalGuides.push(canvasCenterY);
    }

    // Snap to other objects' edges and centers
    objects
      .filter((o) => o.id !== id && o.side === side)
      .forEach((otherObj) => {
        const otherNode = stageRef.current.findOne(`#${otherObj.id}`);
        if (otherNode) {
          const otherBox = otherNode.getClientRect();
          const otherLeft = otherBox.x;
          const otherRight = otherBox.x + otherBox.width;
          const otherTop = otherBox.y;
          const otherBottom = otherBox.y + otherBox.height;
          const otherCenterX = otherBox.x + otherBox.width / 2;
          const otherCenterY = otherBox.y + otherBox.height / 2;

          // Snap left edge of dragged object
          if (Math.abs(objectLeft - otherLeft) <= snapTolerance) {
            newX = otherLeft + box.width / 2;
            verticalGuides.push(otherLeft);
          } else if (Math.abs(objectLeft - otherRight) <= snapTolerance) {
            newX = otherRight + box.width / 2;
            verticalGuides.push(otherRight);
          } else if (Math.abs(objectLeft - otherCenterX) <= snapTolerance) {
            newX = otherCenterX + box.width / 2;
            verticalGuides.push(otherCenterX);
          }

          // Snap right edge of dragged object
          if (Math.abs(objectRight - otherRight) <= snapTolerance) {
            newX = otherRight - box.width / 2;
            verticalGuides.push(otherRight);
          } else if (Math.abs(objectRight - otherLeft) <= snapTolerance) {
            newX = otherLeft - box.width / 2;
            verticalGuides.push(otherLeft);
          } else if (Math.abs(objectRight - otherCenterX) <= snapTolerance) {
            newX = otherCenterX - box.width / 2;
            verticalGuides.push(otherCenterX);
          }

          // Snap top edge of dragged object
          if (Math.abs(objectTop - otherTop) <= snapTolerance) {
            newY = otherTop + box.height / 2;
            horizontalGuides.push(otherTop);
          } else if (Math.abs(objectTop - otherBottom) <= snapTolerance) {
            newY = otherBottom + box.height / 2;
            horizontalGuides.push(otherBottom);
          } else if (Math.abs(objectTop - otherCenterY) <= snapTolerance) {
            newY = otherCenterY + box.height / 2;
            horizontalGuides.push(otherCenterY);
          }

          // Snap bottom edge of dragged object
          if (Math.abs(objectBottom - otherBottom) <= snapTolerance) {
            newY = otherBottom - box.height / 2;
            horizontalGuides.push(otherBottom);
          } else if (Math.abs(objectBottom - otherTop) <= snapTolerance) {
            newY = otherTop - box.height / 2;
            horizontalGuides.push(otherTop);
          } else if (Math.abs(objectBottom - otherCenterY) <= snapTolerance) {
            newY = otherCenterY - box.height / 2;
            horizontalGuides.push(otherCenterY);
          }
        }
      });

    // Update guides
    setGuides({ horizontal: [...new Set(horizontalGuides)], vertical: [...new Set(verticalGuides)] });

    // Update object position
    node.position({ x: newX, y: newY });
    const updatedObjects = objects.map((o) =>
      o.id === id ? { ...o, x: newX, y: newY, status: getObjectStatus(o, node) } : o
    );
    setObjects(updateObjectStatuses(updatedObjects));

    // Update cursor indicator
    setCursorIndicator({
      visible: true,
      x: pos.x + 10,
      y: pos.y - 20,
      text: status === 'partial' ? '⚠️' : status === 'outside' ? '❗' : '',
    });
  };

  const handleDragEnd = (e) => {
    const nodes = transformerRef.current.nodes();
    const updatedObjects = objects.map((obj) => {
      if (selectedObjectIds.has(obj.id)) {
        const node = nodes.find((n) => Number(n.id()) === obj.id);
        if (node) {
          return {
            ...obj,
            x: node.x(),
            y: node.y(),
            rotation: Math.round(node.rotation()),
            status: getObjectStatus(obj, node),
          };
        }
      }
      return obj;
    });
    setObjects(updateObjectStatuses(updatedObjects));
    setDraggingObjectId(null);
    setCursorIndicator({ visible: false, x: 0, y: 0, text: '' });
    setGuides({ horizontal: [], vertical: [] });
    addToHistory(updatedObjects, size);
  };

  const handleTextDblClick = (obj) => {
    const node = stageRef.current.findOne(`#${obj.id}`);
    if (!node) return;

    setSelectedObjectIds(new Set());

    const textPosition = node.absolutePosition();
    const stageContainer = stageRef.current.getStage().container();
    const areaPosition = {
      x: stageContainer.offsetLeft + textPosition.x - (obj.width / 2),
      y: stageContainer.offsetTop + textPosition.y - (obj.height / 2),
    };

    const textarea = document.createElement('textarea');
    textarea.value = obj.value;
    textarea.style.position = 'absolute';
    textarea.style.top = `${areaPosition.y}px`;
    textarea.style.left = `${areaPosition.x}px`;
    textarea.style.width = `${obj.width}px`;
    textarea.style.height = `${obj.height}px`;
    textarea.style.fontSize = `${obj.fontSize}px`;
    textarea.style.fontFamily = obj.fontFamily;
    textarea.style.color = obj.fill;
    textarea.style.lineHeight = obj.lineHeight.toString();
    textarea.style.letterSpacing = `${obj.letterSpacing}px`;
    textarea.style.textAlign = obj.align;
    textarea.style.padding = '5px';
    textarea.style.border = '2px solid #0288d1';
    textarea.style.background = 'white';
    textarea.style.zIndex = '1000';
    textarea.style.boxSizing = 'border-box';
    textarea.style.resize = 'none';
    textarea.style.fontStyle = obj.fontStyle.includes('italic') ? 'italic' : 'normal';
    textarea.style.fontWeight = obj.fontStyle.includes('bold') ? 'bold' : 'normal';
    textarea.style.textDecoration = obj.textDecoration || 'none';

    document.body.appendChild(textarea);
    textarea.focus();
    textarea.select();

    const handleBlur = () => {
      const newValue = textarea.value.trim() || 'Введите текст...';
      handleObjectUpdate('value', newValue);
      document.body.removeChild(textarea);
      setSelectedObjectIds(new Set([obj.id]));
    };

    const handleKeyDown = (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        const newValue = textarea.value.trim() || 'Введите текст...';
        handleObjectUpdate('value', newValue);
        document.body.removeChild(textarea);
        setSelectedObjectIds(new Set([obj.id]));
      } else if (e.key === 'Escape') {
        document.body.removeChild(textarea);
        setSelectedObjectIds(new Set([obj.id]));
      }
    };

    textarea.addEventListener('blur', handleBlur);
    textarea.addEventListener('keydown', handleKeyDown);

    return () => {
      textarea.removeEventListener('blur', handleBlur);
      textarea.removeEventListener('keydown', handleKeyDown);
    };
  };

  // Normalize angle to be within [-180, 180]
  const normalizeAngle = (angle) => {
    let normalized = angle % 360;
    if (normalized > 180) normalized -= 360;
    if (normalized < -180) normalized += 360;
    return normalized;
  };

  // Snap angle to nearest snap angle
  const snapToAngle = (angle) => {
    const normalized = normalizeAngle(angle);
    let minDiff = snapTolerance;
    let snappedAngle = normalized;

    snapAngles.forEach((snapAngle) => {
      const diff = Math.min(
        Math.abs(normalized - snapAngle),
        Math.abs(normalized - (snapAngle + 360)),
        Math.abs(normalized - (snapAngle - 360))
      );
      if (diff < minDiff) {
        minDiff = diff;
        snappedAngle = snapAngle;
      }
    });

    return snappedAngle;
  };

  // Modified to prevent position change during resizing and remove maxSize constraint
  const handleTransform = (e) => {
    const nodes = transformerRef.current.nodes();
    const anchor = transformerRef.current.getActiveAnchor();
    const updatedObjects = objects.map((obj) => {
      if (selectedObjectIds.has(obj.id)) {
        const node = nodes.find((n) => Number(n.id()) === obj.id);
        if (node) {
          // For rotation - just snap the angle
          if (anchor === 'rotater') {
            const newRotation = snapToAngle(node.rotation());
            node.rotation(newRotation);
            return {
              ...obj,
              rotation: newRotation,
              status: getObjectStatus(obj, node),
            };
          }

          // For resizing - maintain center position and remove maxSize limit
          const scaleX = node.scaleX();
          const scaleY = node.scaleY();
          
          // Calculate new size in local coordinates without maxSize constraint
          const newWidth = Math.max(minSize, obj.width * scaleX);
          const newHeight = Math.max(minSize, obj.height * scaleY);

          // Reset scale to 1 after applying to width/height
          node.scaleX(1);
          node.scaleY(1);

          // Maintain center position by using original x, y
          const centerX = obj.x;
          const centerY = obj.y;
          
          return {
            ...obj,
            x: centerX,
            y: centerY,
            width: newWidth,
            height: newHeight,
            rotation: node.rotation(),
            status: getObjectStatus(obj, node),
          };
        }
      }
      return obj;
    });

    const angle = nodes[0]?.rotation() || 0;
    const rotateAnchor = transformerRef.current.findOne('.rotater');
    if (rotateAnchor) {
      const anchorPos = rotateAnchor.absolutePosition();
      setRotationAngle(angle);
      setRotationAnchorPos({ x: anchorPos.x, y: anchorPos.y - 20 });
    }

    setObjects(updateObjectStatuses(updatedObjects));
  };

  const handleTransformEnd = () => {
    const nodes = transformerRef.current.nodes();
    const updatedObjects = objects.map((obj) => {
      if (selectedObjectIds.has(obj.id)) {
        const node = nodes.find((n) => Number(n.id()) === obj.id);
        if (node) {
          // Snap rotation to nearest angle
          const newRotation = snapToAngle(node.rotation());
          node.rotation(newRotation);

          return {
            ...obj,
            x: node.x(),
            y: node.y(),
            width: node.width() * node.scaleX(),
            height: node.height() * node.scaleY(),
            rotation: newRotation,
            scaleX: 1,
            scaleY: 1,
            status: getObjectStatus(obj, node),
          };
        }
      }
      return obj;
    });

    setObjects(updateObjectStatuses(updatedObjects));
    setRotationAngle(null);
    setRotationAnchorPos(null);
    setGuides({ horizontal: [], vertical: [] });
    addToHistory(updatedObjects, size);
  };

  return (
    <Stage
      width={workspaceSize.width}
      height={workspaceSize.height}
      ref={stageRef}
      onMouseDown={handleStageMouseDown}
      onMouseMove={handleStageMouseMove}
      onMouseUp={handleStageMouseUp}
      className="border border-gray-300 shadow-lg focus:outline-none focus:ring-2 focus:ring-primary"
    >
      <Layer>
        <Rect
          x={canvasBounds.x}
          y={canvasBounds.y}
          width={canvasBounds.width}
          height={canvasBounds.height}
          fill="white"
          stroke="black"
          strokeWidth={1}
          shadowColor="rgba(0, 0, 0, 0.2)"
          shadowBlur={10}
        />
        {objects
          .filter((obj) => obj.side === side)
          .sort((a, b) => a.zIndex - b.zIndex)
          .map((obj) => {
            let width, height;
            if (obj.type === 'image') {
              width = obj.width;
              height = obj.height;
            } else {
              width = obj.width;
              height = obj.height;
            }

            if (obj.type === 'text') {
              return (
                <Text
                  key={obj.id}
                  id={obj.id.toString()}
                  text={obj.value}
                  x={obj.x}
                  y={obj.y}
                  fontSize={obj.fontSize}
                  fontFamily={obj.fontFamily}
                  fill={obj.fill}
                  align={obj.align}
                  lineHeight={obj.lineHeight}
                  letterSpacing={obj.letterSpacing}
                  stroke={obj.stroke}
                  strokeWidth={obj.strokeWidth}
                  shadowOffsetX={obj.shadowOffsetX}
                  shadowOffsetY={obj.shadowOffsetY}
                  shadowBlur={obj.shadowBlur}
                  shadowOpacity={obj.shadowOpacity}
                  shadowColor={obj.shadowColor}
                  rotation={obj.rotation}
                  width={obj.width}
                  height={obj.height}
                  offsetX={width / 2}
                  offsetY={height / 2}
                  fontStyle={`${obj.fontStyle.includes('italic') ? 'italic' : ''} ${obj.fontStyle.includes('bold') ? 'bold' : ''}`.trim()}
                  textDecoration={obj.textDecoration || 'none'}
                  draggable
                  onDragStart={(e) => handleDragStart(e, obj.id)}
                  onDragMove={(e) => handleDragMove(e, obj.id)}
                  onDragEnd={handleDragEnd}
                  onClick={(e) => {
                    const newSelected = new Set(e.evt.shiftKey ? selectedObjectIds : []);
                    if (newSelected.has(obj.id)) {
                      newSelected.delete(obj.id);
                    } else {
                      newSelected.add(obj.id);
                    }
                    setSelectedObjectIds(newSelected);
                  }}
                  onDblClick={() => handleTextDblClick(obj)}
                  onContextMenu={(e) => e.evt.preventDefault()}
                  onMouseEnter={() => (document.body.style.cursor = 'move')}
                  onMouseLeave={() => (document.body.style.cursor = 'default')}
                />
              );
            } else if (obj.type === 'image') {
              return (
                <KonvaImage
                  key={obj.id}
                  id={obj.id.toString()}
                  image={obj.image}
                  x={obj.x}
                  y={obj.y}
                  width={obj.width}
                  height={obj.height}
                  rotation={obj.rotation}
                  offsetX={obj.width / 2}
                  offsetY={obj.height / 2}
                  opacity={obj.opacity}
                  filters={[Konva.Filters.Brighten, Konva.Filters.Contrast, Konva.Filters.HSL]}
                  brightness={obj.brightness / 100}
                  contrast={obj.contrast / 100}
                  saturation={obj.saturation / 100}
                  draggable
                  onDragStart={(e) => handleDragStart(e, obj.id)}
                  onDragMove={(e) => handleDragMove(e, obj.id)}
                  onDragEnd={handleDragEnd}
                  onClick={(e) => {
                    const newSelected = new Set(e.evt.shiftKey ? selectedObjectIds : []);
                    if (newSelected.has(obj.id)) {
                      newSelected.delete(obj.id);
                    } else {
                      newSelected.add(obj.id);
                    }
                    setSelectedObjectIds(newSelected);
                  }}
                  onMouseEnter={() => (document.body.style.cursor = 'move')}
                  onMouseLeave={() => (document.body.style.cursor = 'default')}
                />
              );
            }
            return null;
          })}
        {selectionRect.visible && (
          <Rect
            x={selectionRect.x}
            y={selectionRect.y}
            width={selectionRect.width}
            height={selectionRect.height}
            fill="rgba(0, 136, 209, 0.2)"
            stroke="#0288d1"
            strokeWidth={1}
            dash={[4, 4]}
          />
        )}
        {cursorIndicator.visible && (
          <Text
            x={cursorIndicator.x}
            y={cursorIndicator.y}
            text={cursorIndicator.text}
            fontSize={20}
            fill={cursorIndicator.text === '⚠️' ? '#FFC107' : '#FF0000'}
            fontFamily="Arial"
          />
        )}
        {guides.vertical.map((x, i) => (
          <Line
            key={`v-guide-${i}`}
            points={[x, canvasBounds.y, x, canvasBounds.y + canvasBounds.height]}
            stroke="red"
            strokeWidth={1}
            dash={[4, 4]}
          />
        ))}
        {guides.horizontal.map((y, i) => (
          <Line
            key={`h-guide-${i}`}
            points={[canvasBounds.x, y, canvasBounds.x + canvasBounds.width, y]}
            stroke="red"
            strokeWidth={1}
            dash={[4, 4]}
          />
        ))}
      </Layer>
      <Layer>
        <Transformer
          ref={transformerRef}
          rotateAnchorOffset={20}
          anchorSize={10}
          anchorFill="#ffffff"
          anchorStroke="#0288d1"
          borderStroke="#0288d1"
          borderDash={[3, 3]}
          enabledAnchors={['top-left', 'top-right', 'bottom-left', 'bottom-right', 'middle-left', 'middle-right', 'top-center', 'bottom-center']}
          rotateEnabled={true}
          keepRatio={false}
          boundBoxFunc={(oldBox, newBox) => {
            // Allow free transformation, we'll handle constraints in transform handlers
            return newBox;
          }}
          onTransform={handleTransform}
          onTransformEnd={handleTransformEnd}
        />
        {rotationAngle !== null && rotationAnchorPos && (
          <Text
            x={rotationAnchorPos.x - 20}
            y={rotationAnchorPos.y - 10}
            text={`${Math.round(rotationAngle)}°`}
            fontSize={12}
            fontFamily="Inter"
            fill="#0288d1"
            align="center"
            background="#ffffff"
            padding={4}
          />
        )}
      </Layer>
    </Stage>
  );
}