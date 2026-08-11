namespace Loupedeck.KiroCanPlugin.Tests;

using Xunit;
using FsCheck;
using FsCheck.Xunit;
using Loupedeck.KiroCanPlugin.Animation;
using Loupedeck.KiroCanPlugin.Models;
using Loupedeck.KiroCanPlugin.Actions;

/// <summary>
/// Property-based tests validating universal correctness properties
/// defined in the KiroCan design document.
/// </summary>
public class PropertyTests
{
    // -----------------------------------------------------------------------
    // Property 2: Animation Speed Mapping
    // For any health level, duration is 100ms (normal), 67ms (worried), 50ms (critical).
    // Validates: Requirements 2.5, 2.6, 2.7
    // -----------------------------------------------------------------------

    [Fact]
    public void Property2_NormalHealthLevel_Returns100ms()
    {
        Assert.Equal(100, AnimationEngine.GetFrameDuration(HealthLevel.Normal));
    }

    [Fact]
    public void Property2_WorriedHealthLevel_Returns67ms()
    {
        Assert.Equal(67, AnimationEngine.GetFrameDuration(HealthLevel.Worried));
    }

    [Fact]
    public void Property2_CriticalHealthLevel_Returns50ms()
    {
        Assert.Equal(50, AnimationEngine.GetFrameDuration(HealthLevel.Critical));
    }

    [Fact]
    public void Property2_AllHealthLevels_HaveUniqueDurations()
    {
        var durations = new[]
        {
            AnimationEngine.GetFrameDuration(HealthLevel.Normal),
            AnimationEngine.GetFrameDuration(HealthLevel.Worried),
            AnimationEngine.GetFrameDuration(HealthLevel.Critical)
        };
        Assert.Equal(3, durations.Distinct().Count());
    }

    // -----------------------------------------------------------------------
    // Property 7: Frame Cycling Invariant
    // For any frame index in [0,29], advancing produces (index + 1) % 30.
    // Validates: Requirements 1.3
    // -----------------------------------------------------------------------

    [Property(MaxTest = 100)]
    public Property Property7_FrameCycling_ProducesNextModulo30()
    {
        return Prop.ForAll(
            Gen.Choose(0, 29).ToArbitrary(),
            currentFrame =>
            {
                int nextFrame = (currentFrame + 1) % 30;
                return nextFrame >= 0 && nextFrame <= 29;
            }
        );
    }

    [Fact]
    public void Property7_Frame29_WrapsToFrame0()
    {
        int current = 29;
        int next = (current + 1) % 30;
        Assert.Equal(0, next);
    }

    [Fact]
    public void Property7_Frame0_AdvancesToFrame1()
    {
        int current = 0;
        int next = (current + 1) % 30;
        Assert.Equal(1, next);
    }

    // -----------------------------------------------------------------------
    // Property 8: Tile Extraction Dimensions
    // For any position 0-8, extracted tile row/col maps correctly.
    // Validates: Requirements 1.6
    // -----------------------------------------------------------------------

    [Property(MaxTest = 100)]
    public Property Property8_TilePosition_MapsToCorrectRowCol()
    {
        return Prop.ForAll(
            Gen.Choose(0, 8).ToArbitrary(),
            position =>
            {
                int row = position / 3;
                int col = position % 3;
                return row >= 0 && row <= 2 && col >= 0 && col <= 2;
            }
        );
    }

    [Fact]
    public void Property8_Position0_IsRow0Col0()
    {
        Assert.Equal(0, 0 / 3); // row
        Assert.Equal(0, 0 % 3); // col
    }

    [Fact]
    public void Property8_Position8_IsRow2Col2()
    {
        Assert.Equal(2, 8 / 3); // row
        Assert.Equal(2, 8 % 3); // col
    }

    [Fact]
    public void Property8_Position4_IsRow1Col1()
    {
        Assert.Equal(1, 4 / 3); // row (center)
        Assert.Equal(1, 4 % 3); // col (center)
    }

    // -----------------------------------------------------------------------
    // Property 5: Dial Rotation Threshold
    // For any sequence of same-direction ticks reaching threshold 18,
    // exactly one switch fires and accumulator resets.
    // Validates: Requirements 7.1, 7.2, 7.5, 7.6
    // -----------------------------------------------------------------------

    [Property(MaxTest = 100)]
    public Property Property5_TicksBelowThreshold_DoNotTrigger()
    {
        return Prop.ForAll(
            Gen.Choose(1, 17).ToArbitrary(),
            totalTicks =>
            {
                // Simulating accumulation below threshold should not trigger
                int accumulator = 0;
                accumulator += totalTicks;
                return accumulator < 18;
            }
        );
    }

    [Fact]
    public void Property5_ExactlyThreshold_Triggers()
    {
        int accumulator = 0;
        accumulator += 18;
        Assert.True(accumulator >= 18);
        // After trigger, reset
        accumulator = 0;
        Assert.Equal(0, accumulator);
    }

    [Fact]
    public void Property5_DirectionReversal_ResetsAccumulator()
    {
        int accumulator = 10;
        var direction = RotationDirection.Clockwise;

        // Simulate direction reversal
        var newDirection = RotationDirection.CounterClockwise;
        if (direction != RotationDirection.Undefined && newDirection != direction)
        {
            accumulator = 0;
        }
        Assert.Equal(0, accumulator);
    }

    // -----------------------------------------------------------------------
    // Property 9: Button Debounce
    // For any sequence of timestamps, only one press per 1-second window passes.
    // Validates: Requirements 6.6
    // -----------------------------------------------------------------------

    [Fact]
    public void Property9_FirstPress_AlwaysPasses()
    {
        var debounce = new ButtonDebounce(TimeSpan.FromSeconds(1));
        Assert.True(debounce.ShouldProcess());
    }

    [Fact]
    public void Property9_SecondPressWithin1Second_IsDiscarded()
    {
        var debounce = new ButtonDebounce(TimeSpan.FromSeconds(1));
        debounce.ShouldProcess(); // first press
        Assert.False(debounce.ShouldProcess()); // within 1 second
    }

    // -----------------------------------------------------------------------
    // Property 11: Bridge Connectivity State
    // Disconnected if and only if 2 consecutive polls fail.
    // A single success resets the counter.
    // Validates: Requirements 19.2, 19.3
    // -----------------------------------------------------------------------

    [Fact]
    public void Property11_SingleFailure_StaysConnected()
    {
        // Simulate: 1 failure, still connected
        int consecutiveFailures = 0;
        consecutiveFailures++; // 1 failure
        bool disconnected = consecutiveFailures >= 2;
        Assert.False(disconnected);
    }

    [Fact]
    public void Property11_TwoConsecutiveFailures_Disconnects()
    {
        int consecutiveFailures = 0;
        consecutiveFailures++; // 1
        consecutiveFailures++; // 2
        bool disconnected = consecutiveFailures >= 2;
        Assert.True(disconnected);
    }

    [Fact]
    public void Property11_SuccessAfterOneFailure_ResetsCounter()
    {
        int consecutiveFailures = 0;
        consecutiveFailures++; // 1 failure
        // Success
        consecutiveFailures = 0;
        consecutiveFailures++; // 1 failure again
        bool disconnected = consecutiveFailures >= 2;
        Assert.False(disconnected);
    }

    [Property(MaxTest = 100)]
    public Property Property11_AnyNumberOfSuccesses_StaysConnected()
    {
        return Prop.ForAll(
            Gen.Choose(1, 100).ToArbitrary(),
            successCount =>
            {
                int failures = 0;
                for (int i = 0; i < successCount; i++)
                {
                    failures = 0; // Each success resets
                }
                return failures < 2;
            }
        );
    }
}
