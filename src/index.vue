<template>
  <div
    ref="hostElement"
    class="scrollable-host"
    :class="{
      'always-visible': alwaysVisible,
      'shadow-enabled': shadow,
      scrolled: scrolled,
    }"
    @mouseover="handleComponentMouseOver"
    @mouseout="handleComponentMouseOut"
    @wheel="handleComponentWheel"
  >
    <div
      ref="scrollableContainer"
      class="scrollable-container"
      :style="{ userSelect: isDragging ? 'none' : 'auto' }"
      @scroll="handleScrollableContainerScroll"
    >
      <div class="shadow" :class="{ visible: scrolled }" :style="{ zIndex: scrollbarTrackZ }"></div>

      <div v-if="isDragging" class="prevent-interaction"></div>

      <div
        v-if="scrollbarVisible"
        class="scrollbar-track"
        :style="{ zIndex: scrollbarTrackZ }"
        @mousedown="handleScrollbarTrackPress"
      >
        <div
          ref="scrollThumbElement"
          class="scrollbar-thumb"
          :class="{
            visible: alwaysVisible || thumbVisible,
            fade: !alwaysVisible && thumbFade,
            active: thumbActive,
          }"
          :style="{
            height: `${thumbHeight}px`,
            top: `${thumbY}px`,
          }"
          @mousedown="handleScrollThumbMouseDown"
        ></div>
      </div>

      <div ref="contentElement" class="content">
        <slot @slotchange="handleSlotChange"></slot>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import {
	computed,
	nextTick,
	onBeforeUnmount,
	onMounted,
	ref,
	watch,
} from "vue";

export interface VueScrollableScrollEvent {
	detail: number;
}

interface Props {
	alwaysVisible?: boolean;
	fastScrollSensitivity?: number;
	minThumbSize?: number;
	mouseWheelScrollSensitivity?: number;
	shadow?: boolean;
	scrollPos?: number;
}

const props = withDefaults(defineProps<Props>(), {
	alwaysVisible: false,
	fastScrollSensitivity: 5,
	minThumbSize: 20,
	mouseWheelScrollSensitivity: 1,
	shadow: true,
	scrollPos: 0,
});

const emit = defineEmits<{
	"update:scrollPos": [value: number];
	"vue-scrollable-scroll": [event: VueScrollableScrollEvent];
}>();

const hostElement = ref<HTMLDivElement>();
const scrollableContainer = ref<HTMLDivElement>();
const contentElement = ref<HTMLDivElement>();
const scrollThumbElement = ref<HTMLDivElement>();

const internalScrollPos = ref(0);
const isDragging = ref(false);
const thumbHeight = ref(0);
const thumbY = ref(0);
const thumbVisible = ref(false);
const thumbFade = ref(false);
const thumbActive = ref(false);
const scrolled = ref(false);

const componentHeight = ref(0);
const contentHeight = ref(0);
const scrollThumbStartY = ref(0);
const mouseStartY = ref(0);
const scrollbarVisible = ref(true);
const scrollbarTrackZ = ref(0);

let hostResizeObserver: ResizeObserver | null = null;
let contentResizeObserver: ResizeObserver | null = null;

const scrollMax = computed(() => {
	if (!scrollableContainer.value) {
		return 0;
	}
	return (
		scrollableContainer.value.scrollHeight -
		scrollableContainer.value.clientHeight
	);
});

watch(
	() => props.scrollPos,
	(newVal) => {
		internalScrollPos.value = limitScrollPos(newVal);
		updateScrollbar();
		updateThumbPosition();
	},
);

watch(internalScrollPos, (newVal) => {
	if (scrollableContainer.value) {
		scrollableContainer.value.scrollTop = newVal;
	}
	emit("update:scrollPos", newVal);
});

const limitScrollPos = (newPos: number): number => {
	if (newPos < 0) {
		return 0;
	} else if (newPos > scrollMax.value) {
		return scrollMax.value;
	} else {
		return newPos;
	}
};

const limitThumbPos = (newPos: number): number => {
	if (!hostElement.value || !scrollThumbElement.value) {
		return 0;
	}

	const cmpH = hostElement.value.getBoundingClientRect().height;
	const thumbH = scrollThumbElement.value.getBoundingClientRect().height;

	if (newPos < 0) {
		return 0;
	} else if (newPos > cmpH - thumbH) {
		return cmpH - thumbH;
	} else {
		return newPos;
	}
};

const calcThumbHeight = (): number => {
	if (!hostElement.value || !contentElement.value) {
		return props.minThumbSize;
	}

	const componentH = hostElement.value.offsetHeight;
	const contentH = contentElement.value.offsetHeight;
	const proposedSize = componentH * (componentH / contentH);

	return Math.max(props.minThumbSize, proposedSize);
};

const updateScrollbar = () => {
	if (!contentElement.value || !hostElement.value) {
		return;
	}

	const contentH = contentElement.value.offsetHeight;
	const componentH = hostElement.value.offsetHeight;

	if (componentH >= contentH) {
		scrollbarVisible.value = false;
	} else {
		scrollbarVisible.value = true;
		thumbHeight.value = calcThumbHeight();
	}
};

const updateThumbPosition = () => {
	if (
		!scrollableContainer.value ||
		!hostElement.value ||
		!contentElement.value
	) {
		return;
	}

	scrolled.value = internalScrollPos.value > 0;

	const componentH = hostElement.value.offsetHeight;
	const thumbH = thumbHeight.value;
	const contentH = contentElement.value.offsetHeight;

	const overflown = contentH - componentH;
	const ratio = internalScrollPos.value / overflown;
	const thumbYMax = componentH - thumbH;

	thumbY.value = Math.min(ratio * (componentH - thumbH), thumbYMax);
};

const calculateScrollPosFromThumbPos = (scrollPos: number): number => {
	if (
		!hostElement.value ||
		!scrollThumbElement.value ||
		!contentElement.value
	) {
		return 0;
	}

	const cmpH = hostElement.value.getBoundingClientRect().height;
	const thumbH = scrollThumbElement.value.getBoundingClientRect().height;
	const contentH = contentElement.value.getBoundingClientRect().height;
	const rawScrollPos = (scrollPos / (cmpH - thumbH)) * (contentH - cmpH);

	return limitScrollPos(rawScrollPos);
};

const zIndexFix = () => {
	if (!contentElement.value) {
		return;
	}

	let highestZ = 0;
	const children = contentElement.value.children;

	Array.from(children).forEach((child) => {
		const computedZIndex = window.getComputedStyle(child as HTMLElement).zIndex;
		const isNumber = /([0-9-])+/g.test(computedZIndex);

		if (isNumber) {
			highestZ = Math.max(Number(computedZIndex), highestZ);
		}
	});

	scrollbarTrackZ.value = highestZ + 1;
};

const resizeObserverCallback = () => {
	if (!hostElement.value || !contentElement.value) {
		return;
	}

	componentHeight.value = hostElement.value.offsetHeight;
	contentHeight.value = contentElement.value.offsetHeight;
	updateScrollbar();
	updateThumbPosition();
};

const handleSlotChange = () => {
	updateScrollbar();
	updateThumbPosition();
	zIndexFix();
};

const handleScrollThumbMouseDown = (event: MouseEvent) => {
	if (!hostElement.value || !scrollThumbElement.value) {
		return;
	}

	const cmpCr = hostElement.value.getBoundingClientRect();
	const thCr = scrollThumbElement.value.getBoundingClientRect();

	mouseStartY.value = event.screenY;
	scrollThumbStartY.value = thCr.top - cmpCr.top;
	isDragging.value = true;
	thumbActive.value = true;

	document.addEventListener("mousemove", handleScrollThumbMouseMove);
	document.addEventListener("mouseup", handleScrollThumbMouseUp);
};

const handleScrollThumbMouseMove = (event: MouseEvent) => {
	const rawThumbPos =
		scrollThumbStartY.value + (event.screenY - mouseStartY.value);
	thumbY.value = limitThumbPos(rawThumbPos);
	internalScrollPos.value = calculateScrollPosFromThumbPos(thumbY.value);

	emit("vue-scrollable-scroll", {
		detail: internalScrollPos.value,
	});
};

const handleScrollThumbMouseUp = (event: MouseEvent) => {
	isDragging.value = false;
	thumbActive.value = false;

	if (!hostElement.value) {
		return;
	}

	const cr = hostElement.value.getBoundingClientRect();
	const { x, y, width, height } = cr;
	const { pageX, pageY } = event;

	if (pageX > x + width || pageX < x || pageY > y + height || pageY < y) {
		thumbFade.value = true;
		thumbVisible.value = false;
	}

	document.removeEventListener("mousemove", handleScrollThumbMouseMove);
	document.removeEventListener("mouseup", handleScrollThumbMouseUp);
};

const handleComponentMouseOver = () => {
	thumbVisible.value = true;
	thumbFade.value = false;
};

const handleComponentMouseOut = () => {
	if (!thumbActive.value) {
		thumbVisible.value = false;
		thumbFade.value = true;
	}
};

const handleComponentWheel = (ev: WheelEvent) => {
	if (contentHeight.value <= componentHeight.value) {
		return;
	}

	ev.preventDefault();

	const multiplier = ev.altKey
		? props.mouseWheelScrollSensitivity * props.fastScrollSensitivity
		: props.mouseWheelScrollSensitivity;

	internalScrollPos.value = limitScrollPos(
		internalScrollPos.value + ev.deltaY * multiplier,
	);

	emit("vue-scrollable-scroll", {
		detail: internalScrollPos.value,
	});
};

const handleScrollbarTrackPress = (ev: MouseEvent) => {
	if (ev.target !== ev.currentTarget) {
		return;
	}

	thumbY.value = ev.offsetY - thumbHeight.value / 2;
	internalScrollPos.value = calculateScrollPosFromThumbPos(thumbY.value);
};

const handleScrollableContainerScroll = (ev: Event) => {
	if (ev.currentTarget) {
		internalScrollPos.value = (ev.currentTarget as HTMLDivElement).scrollTop;
	}
};

onMounted(() => {
	nextTick(() => {
		if (hostElement.value && contentElement.value) {
			hostResizeObserver = new ResizeObserver(resizeObserverCallback);
			contentResizeObserver = new ResizeObserver(resizeObserverCallback);

			hostResizeObserver.observe(hostElement.value);
			contentResizeObserver.observe(contentElement.value);

			updateThumbPosition();
			zIndexFix();
		}
	});
});

onBeforeUnmount(() => {
	if (hostResizeObserver && hostElement.value) {
		hostResizeObserver.unobserve(hostElement.value);
		hostResizeObserver.disconnect();
	}

	if (contentResizeObserver && contentElement.value) {
		contentResizeObserver.unobserve(contentElement.value);
		contentResizeObserver.disconnect();
	}

	document.removeEventListener("mousemove", handleScrollThumbMouseMove);
	document.removeEventListener("mouseup", handleScrollThumbMouseUp);
});

defineExpose({
	scrollPos: computed({
		get: () => internalScrollPos.value,
		set: (val: number) => {
			internalScrollPos.value = limitScrollPos(val);
			updateScrollbar();
			updateThumbPosition();
		},
	}),
	scrollMax,
});
</script>

<style scoped>
.scrollable-host {
  display: block;
  position: relative;
}

.scrollable-container {
  height: 100%;
  overflow: auto;
}

.scrollable-container::-webkit-scrollbar {
  cursor: default;
  width: 0;
}

.scrollable-container {
  scrollbar-width: none;
}

.shadow {
  box-shadow: var(--vueroll-scrollbar-shadow, #000000) 0 6px 6px -6px inset;
  display: none;
  height: 3px;
  left: 0;
  pointer-events: none;
  position: absolute;
  top: 0;
  z-index: 1;
  width: 100%;
}

.shadow.visible {
  display: block;
}

.scrollbar-track {
  height: 100%;
  position: absolute;
  right: 0;
  top: 0;
  width: 10px;
  z-index: 100;
}

.scrollbar-thumb {
  background-color: transparent;
  min-height: var(--min-thumb-height, 20px);
  opacity: 0;
  position: absolute;
  right: 0;
  width: 10px;
}

.scrollbar-thumb.visible {
  background-color: var(--vueroll-scrollbarSlider-background, rgba(121, 121, 121, 0.4));
  opacity: 1;
  transition: opacity 100ms;
}

.scrollbar-thumb.fade {
  background-color: var(--vueroll-scrollbarSlider-background, rgba(121, 121, 121, 0.4));
  opacity: 0;
  transition: opacity 800ms;
}

.scrollbar-thumb.visible:hover {
  background-color: var(--vueroll-scrollbarSlider-hoverBackground, rgba(100, 100, 100, 0.7));
}

.scrollbar-thumb.visible.active,
.scrollbar-thumb.visible.active:hover {
  background-color: var(--vueroll-scrollbarSlider-activeBackground, rgba(191, 191, 191, 0.4));
}

.prevent-interaction {
  bottom: 0;
  left: 0;
  right: 0;
  top: 0;
  position: absolute;
  z-index: 99;
}

.content {
  overflow: hidden;
}
</style>
