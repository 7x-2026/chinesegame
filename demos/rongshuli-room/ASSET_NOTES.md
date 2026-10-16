# 美术素材记录

所有素材均使用内置 `image_gen.imagegen`（通过 `tools.image_gen__imagegen` 调用）生成或编辑，没有使用 CLI、外部 API 或 Python 编辑图片。仓库保存最终素材与原始概念参考图，中间生成文件不入库。下列提示词逐字记录调用时的原文。

## 活动室背景

- 项目素材：`dist/assets/activity-room.png`
- 原始参考图：[活动室概念图](../../docs/images/activity-room-concept.png)
- 内置工具参数：`referenced_image_paths` 为上述原始参考图；`transparent_background: false`。
- 输出尺寸：1672 × 941。

### 完整最终提示词

```text
Use case: precise-object-edit. Asset type: interactive game room background. Edit the supplied image with surgical precision. Preserve exactly the same full landscape image composition, camera viewpoint, dimensions/aspect ratio, all furniture, every person and the cat in their exact locations and poses, warm sunlight, signs and text, expressive illustrated painting style, and all decorative objects. Change ONLY the blue ribbons: remove the blue ribbon from the cat's mouth and from the floor immediately around the cat, reconstructing the cat's fur/mouth and woven rug naturally; remove all obvious blue ribbon loops and strips in and draped over the wooden box beside the kneeling girl in the right foreground, replacing just those ribbon pixels with the existing box and assorted non-blue craft supplies. Do not remove the cat, do not move anyone, do not add objects, do not alter any other blue objects such as clothes or paint cups. Keep everything else identical.
```

## 可移动主角

- 项目素材：`dist/assets/player.png`
- 内置工具参数：`referenced_image_paths` 为下述第一次主角生成结果；`transparent_background: true`。
- 输出尺寸：1024 × 1536，RGBA。已读取 PNG 像素验证背景的 alpha 值为 0。
- 实际角色约五头身，略高于初始设想的四头身，其他服装和视角要求保持。

### 完整最终提示词

```text
Use case: background-extraction. Edit target: supplied standalone child sprite. Preserve the child exactly: same full-body outline, face, hair, cream top, teal trousers, orange backpack, shoes, pose, size and painterly style. Remove ALL background, including the brown/cream glow, fog, rim halo, ground shadow and every dark or colored background pixel outside the actual child silhouette. Output a precise clean cutout on fully transparent alpha, with crisp natural anti-aliased silhouette edges around hair, clothing, fingers and shoes. The entirety outside the child must be 100% transparent, including space between legs, between arms and torso, and all canvas corners. Do not add a drop shadow or any aura. No scene or text. Do not alter the child.
```

### 初次主角生成记录

最终主角经过一次内置工具的透明边缘清理。为完整保留来源，初次生成参数及提示词如下。

- 输入风格参考图：[活动室概念图](../../docs/images/activity-room-concept.png)
- 内置工具参数：`referenced_image_paths` 为输入风格参考图；`transparent_background: true`。

```text
Use case: stylized-concept. Asset type: single transparent game character sprite. The supplied image is ONLY a STYLE REFERENCE for the warm painterly animated-storybook illustration, natural soft sunlight and expressive children. Generate exactly ONE approximately 10-year-old child protagonist as a standalone full-body cutout on a genuinely transparent background, with no room, furniture, props, text, border or scenery. Outfit: cream long-sleeved top, teal green trousers, light sneakers, small orange backpack worn on both shoulders. About four heads tall, charming game character proportions, short dark brown tousled hair. View from behind and slightly to the child's left side, three-quarter rear view; the child faces toward the upper right of the canvas, suitable for walking into the pictured room. Both arms hanging naturally at sides, relaxed neutral standing pose, both legs and feet visible and separated slightly. Entire character including hair and shoes fully inside canvas with modest transparent margin. Draw the character large and centered, feet near lower middle. Match reference's polished painterly outlines, soft fabric textures and appealing animation-film warmth, but make silhouette clear at small size. No ground plane or cast shadow; actual alpha transparency.
```
