// Ported from get-caret-coordinates
const properties = [
  'direction',
  'boxSizing',
  'width',
  'height',
  'overflowX',
  'overflowY',
  'borderTopWidth',
  'borderRightWidth',
  'borderBottomWidth',
  'borderLeftWidth',
  'borderStyle',
  'paddingTop',
  'paddingRight',
  'paddingBottom',
  'paddingLeft',
  'fontStyle',
  'fontVariant',
  'fontWeight',
  'fontStretch',
  'fontSize',
  'fontSizeAdjust',
  'lineHeight',
  'fontFamily',
  'textAlign',
  'textTransform',
  'textIndent',
  'textDecoration',
  'letterSpacing',
  'wordSpacing',
  'tabSize',
  'MozTabSize'
];

export function getCaretCoordinates(element: HTMLTextAreaElement, position: number) {
  const div = document.createElement('div');
  div.id = 'input-textarea-caret-position-mirror-div';
  document.body.appendChild(div);

  const style = div.style;
  const computed = window.getComputedStyle ? window.getComputedStyle(element) : (element as any).currentStyle;
  const isInput = element.nodeName === 'INPUT';

  style.whiteSpace = 'pre-wrap';
  if (!isInput)
    style.wordWrap = 'break-word';

  style.position = 'absolute';
  style.top = '0';
  style.visibility = 'hidden';

  properties.forEach(prop => {
    style[prop as any] = computed[prop];
  });

  if (window.navigator.userAgent.indexOf('Firefox') > -1) {
    if (element.scrollHeight > parseInt(computed.height))
      style.overflowY = 'scroll';
  } else {
    style.overflow = 'hidden';
  }

  div.textContent = element.value.substring(0, position);
  if (isInput) {
    div.textContent = div.textContent.replace(/\s/g, '\u00a0');
  }

  const span = document.createElement('span');
  span.textContent = element.value.substring(position) || '.';
  div.appendChild(span);

  const coordinates = {
    top: span.offsetTop + parseInt(computed['borderTopWidth']),
    left: span.offsetLeft + parseInt(computed['borderLeftWidth']),
    height: parseInt(computed['lineHeight'])
  };

  document.body.removeChild(div);

  return coordinates;
}
