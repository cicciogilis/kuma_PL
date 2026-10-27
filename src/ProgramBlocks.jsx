import PropTypes from 'prop-types';
import {
  formatAccessoryBlock,
  formatBlock,
  formatRawWeight,
  formatRpeReference,
  formatSuArticolo,
  formatSuggestedWeight,
  getSuggestedWeight,
} from './utils/programDisplay';

const ProgramBlocks = ({ blocks = [], max = null, accessory = false }) => {
  const format = accessory ? formatAccessoryBlock : formatBlock;

  return (
    <div className="program-lift-blocks">
      {blocks.map((block, blockIndex) => {
        const rawWeight = !accessory
          && !block.percentBase
          && block.percent != null
          && max
          ? (max * block.percent) / 100
          : null;
        const suggestedWeight = getSuggestedWeight(rawWeight);
        const hasSuggestion = suggestedWeight != null
          && Math.abs(suggestedWeight - rawWeight) > 1e-6;
        const reference = block.percentBase
          ? formatRpeReference(block.percentBase)
          : '';
        const referencePrefix = formatSuArticolo(reference);

        return (
          <span className="program-block-group" key={`block-${blockIndex}`}>
            {blockIndex > 0 && (
              <span className="program-block-plus" aria-hidden="true">+</span>
            )}
            <span className="program-block">
              {format(block)}
              {rawWeight != null && (
                hasSuggestion ? (
                  <span className="program-block-weight">
                    ({formatRawWeight(rawWeight)}{' '}
                    <span className="program-block-weight-arrow" aria-hidden="true">→</span>{' '}
                    <span className="program-block-suggestion">
                      {formatSuggestedWeight(suggestedWeight)} kg
                    </span>)
                  </span>
                ) : (
                  <span className="program-block-suggestion">
                    ({formatRawWeight(rawWeight)} kg)
                  </span>
                )
              )}
              {block.percentBase && reference && (
                <span className="program-block-reference">
                  (calcolato {referencePrefix}{reference})
                </span>
              )}
            </span>
          </span>
        );
      })}
    </div>
  );
};

ProgramBlocks.propTypes = {
  blocks: PropTypes.arrayOf(PropTypes.object),
  max: PropTypes.number,
  accessory: PropTypes.bool,
};

export default ProgramBlocks;
